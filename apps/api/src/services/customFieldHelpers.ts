import type { PrismaClient, CustomFieldDefinition as PrismaCustomFieldDefinition } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { buildCustomFieldsSchema } from '@shared/utils/custom-fields/builder'
import type { CustomFieldDefinition as BuilderCustomFieldDefinition } from '@shared/utils/custom-fields/types'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

export const isPrismaNull = (value: unknown) =>
  value === null || value === Prisma.JsonNull || value === Prisma.DbNull || value === Prisma.AnyNull

export const toPlainJson = <T>(
  value: Prisma.JsonValue | Prisma.NullTypes.JsonNull | null | undefined
): T | undefined => {
  if (isPrismaNull(value) || value === undefined) {
    return undefined
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return undefined
    }
  }
  return value as T
}

export type DefinitionNode = PrismaCustomFieldDefinition & { children: DefinitionNode[] }

export const buildDefinitionTree = (definitions: PrismaCustomFieldDefinition[]): DefinitionNode[] => {
  const map = new Map<string, DefinitionNode>()
  const roots: DefinitionNode[] = []

  for (const definition of definitions) {
    map.set(definition.id, { ...definition, children: [] })
  }

  for (const node of map.values()) {
    if (node.parentId) {
      const parent = map.get(node.parentId)
      if (parent) {
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: DefinitionNode[]) => {
    nodes.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }
      return a.slug.localeCompare(b.slug)
    })
    nodes.forEach((child) => sortNodes(child.children))
  }

  sortNodes(roots)
  return roots
}

export const mapDefinitionToBuilder = (node: DefinitionNode): BuilderCustomFieldDefinition => {
  const validation = toPlainJson<Record<string, unknown>>(node.validation)

  switch (node.type) {
    case 'group':
      if (node.isRepeatable) {
        if (node.children.length === 0) {
          throw new HTTPException(400, {
            message: `繰り返しグループ「${node.label}」に子定義が存在しません。`,
          })
        }
        if (node.children.length > 1) {
          throw new HTTPException(400, {
            message: `繰り返しグループ「${node.label}」には1件の子定義のみ許可されています。`,
          })
        }
        const itemDefinition = mapDefinitionToBuilder(node.children[0])
        return {
          type: 'repeatable',
          slug: node.slug,
          label: node.label,
          description: node.description ?? undefined,
          validation: validation as BuilderCustomFieldDefinition['validation'],
          itemDefinition,
        }
      }
      return {
        type: 'group',
        slug: node.slug,
        label: node.label,
        description: node.description ?? undefined,
        validation: validation as BuilderCustomFieldDefinition['validation'],
        children: node.children.map(mapDefinitionToBuilder),
      }
    case 'text':
      return {
        type: 'text',
        slug: node.slug,
        label: node.label,
        description: node.description ?? undefined,
        validation: validation as BuilderCustomFieldDefinition['validation'],
        config: toPlainJson(node.config),
      }
    case 'richText':
      return {
        type: 'richText',
        slug: node.slug,
        label: node.label,
        description: node.description ?? undefined,
        validation: validation as BuilderCustomFieldDefinition['validation'],
        config: toPlainJson(node.config),
      }
    case 'date':
      return {
        type: 'date',
        slug: node.slug,
        label: node.label,
        description: node.description ?? undefined,
        validation: validation as BuilderCustomFieldDefinition['validation'],
        config: toPlainJson(node.config),
      }
    case 'file':
      return {
        type: 'file',
        slug: node.slug,
        label: node.label,
        description: node.description ?? undefined,
        validation: validation as BuilderCustomFieldDefinition['validation'],
        config: toPlainJson(node.config),
      }
    case 'select':
      return {
        type: 'select',
        slug: node.slug,
        label: node.label,
        description: node.description ?? undefined,
        validation: validation as BuilderCustomFieldDefinition['validation'],
        config: toPlainJson(node.config),
      }
    case 'checkbox':
      return {
        type: 'checkbox',
        slug: node.slug,
        label: node.label,
        description: node.description ?? undefined,
        validation: validation as BuilderCustomFieldDefinition['validation'],
        config: toPlainJson(node.config),
      }
    default:
      throw new HTTPException(400, { message: `未対応のフィールドタイプです: ${node.type}` })
  }
}

export const formatZodError = (error: ZodError) =>
  error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'customFields'
      return `${path}: ${issue.message}`
    })
    .join(' / ')

export const fetchBuilderDefinitions = async (
  prisma: PrismaClient,
  postSettingId: string
): Promise<BuilderCustomFieldDefinition[]> => {
  const postSetting = await prisma.postSetting.findUnique({ where: { id: postSettingId } })
  if (!postSetting) {
    throw new HTTPException(400, { message: '指定された投稿設定が存在しません。' })
  }

  const definitions = await prisma.customFieldDefinition.findMany({
    where: { postSettingId },
    orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { slug: 'asc' }],
  })

  if (definitions.length === 0) {
    return []
  }

  const tree = buildDefinitionTree(definitions)
  return tree.map(mapDefinitionToBuilder)
}

export const validateCustomFieldsPayload = async (
  prisma: PrismaClient,
  postSettingId: string,
  payload: unknown
): Promise<string | null> => {
  const builderDefinitions = await fetchBuilderDefinitions(prisma, postSettingId)

  if (builderDefinitions.length === 0) {
    if (payload === undefined || payload === null) {
      return null
    }
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      const plain = payload as Record<string, unknown>
      return Object.keys(plain).length === 0 ? null : JSON.stringify(plain)
    }
    // 文字列の場合も許容する（空のJSONなど）
    if (typeof payload === 'string') {
      try {
        const data = JSON.parse(payload)
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          return Object.keys(data).length === 0 ? null : JSON.stringify(data)
        }
      } catch {
        // パース失敗は不正な形式とする
      }
    }
    throw new HTTPException(400, {
      message: 'カスタムフィールドの形式が不正です。オブジェクト形式またはJSON文字列で指定してください。',
    })
  }

  const schema = buildCustomFieldsSchema(builderDefinitions, { context: 'admin' })
  try {
    let dataToParse: unknown = payload ?? {}
    if (typeof payload === 'string') {
      try {
        dataToParse = JSON.parse(payload)
      } catch (e) {
        throw new HTTPException(400, { message: 'カスタムフィールドのJSON形式が不正です。' })
      }
    }

    const parsed = schema.parse(dataToParse) as Record<string, unknown>
    return Object.keys(parsed).length === 0 ? null : JSON.stringify(parsed)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HTTPException(400, {
        message: `カスタムフィールドのバリデーションに失敗しました: ${formatZodError(error)}`,
      })
    }
    throw error
  }
}

export type DefinitionTreeNode = DefinitionNode

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const removeFieldRecursive = (value: unknown, slug: string): { changed: boolean; result: unknown } => {
  if (Array.isArray(value)) {
    let changed = false
    const result = value.map((item) => {
      const transformed = removeFieldRecursive(item, slug)
      if (transformed.changed) {
        changed = true
      }
      return transformed.result
    })
    return { changed, result }
  }

  if (isPlainObject(value)) {
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      if (key === slug) {
        changed = true
        continue
      }
      const transformed = removeFieldRecursive(child, slug)
      if (transformed.changed) {
        changed = true
      }
      next[key] = transformed.result
    }
    return { changed, result: next }
  }

  return { changed: false, result: value }
}

const renameFieldRecursive = (
  value: unknown,
  oldSlug: string,
  newSlug: string
): { changed: boolean; result: unknown } => {
  if (Array.isArray(value)) {
    let changed = false
    const result = value.map((item) => {
      const transformed = renameFieldRecursive(item, oldSlug, newSlug)
      if (transformed.changed) {
        changed = true
      }
      return transformed.result
    })
    return { changed, result }
  }

  if (isPlainObject(value)) {
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      const transformed = renameFieldRecursive(child, oldSlug, newSlug)
      if (transformed.changed) {
        changed = true
      }
      const targetKey = key === oldSlug ? newSlug : key
      if (key === oldSlug) {
        changed = true
      }
      next[targetKey] = transformed.result
    }
    return { changed, result: next }
  }

  return { changed: false, result: value }
}

const hasObjectKeys = (value: unknown): boolean => (isPlainObject(value) ? Object.keys(value).length > 0 : true)

export const removeFieldFromCustomFields = (
  customFields: Prisma.JsonValue | Prisma.NullTypes.JsonNull | null | undefined,
  slug: string
): { changed: boolean; value: string | null } => {
  const plain = toPlainJson<Record<string, unknown>>(customFields)
  if (!plain) {
    return { changed: false, value: null }
  }

  const clone = deepClone(plain)
  const { changed, result } = removeFieldRecursive(clone, slug)
  if (!changed) {
    return { changed: false, value: JSON.stringify(plain) }
  }

  if (!hasObjectKeys(result)) {
    return { changed: true, value: null }
  }

  return { changed: true, value: JSON.stringify(result) }
}

export const renameFieldInCustomFields = (
  customFields: Prisma.JsonValue | Prisma.NullTypes.JsonNull | null | undefined,
  oldSlug: string,
  newSlug: string
): { changed: boolean; value: string | null } => {
  const plain = toPlainJson<Record<string, unknown>>(customFields)
  if (!plain) {
    return { changed: false, value: null }
  }

  const clone = deepClone(plain)
  const { changed, result } = renameFieldRecursive(clone, oldSlug, newSlug)
  if (!changed) {
    return { changed: false, value: JSON.stringify(plain) }
  }

  if (!hasObjectKeys(result)) {
    return { changed: true, value: null }
  }

  return { changed: true, value: JSON.stringify(result) }
}
