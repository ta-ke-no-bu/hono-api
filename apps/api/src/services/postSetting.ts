import type { CustomFieldDefinition, PostSetting, PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import {
  checkboxConfigSchema,
  type customFieldDefinitionResponseSchema,
  type customFieldDefinitionTreeSchema,
  customFieldTypeSchema,
  customFieldValidationSchema,
  dateConfigSchema,
  fileConfigSchema,
  type postSettingCreateSchema,
  type postSettingResponseSchema,
  richTextConfigSchema,
  selectConfigSchema,
  textConfigSchema,
} from '../schemas/postSetting'
import {
  type DefinitionNode,
  buildDefinitionTree,
  removeFieldFromCustomFields,
  renameFieldInCustomFields,
  toPlainJson,
} from './customFieldHelpers'

const configSchemaByType = {
  text: textConfigSchema,
  richText: richTextConfigSchema,
  date: dateConfigSchema,
  file: fileConfigSchema,
  select: selectConfigSchema,
  checkbox: checkboxConfigSchema,
  group: null,
} as const

type ConfigSchemaType = keyof typeof configSchemaByType

type CustomFieldDefinitionResponse = typeof customFieldDefinitionResponseSchema._type
type PostSettingResponse = typeof postSettingResponseSchema._type
type PostSettingCreateInput = typeof postSettingCreateSchema._type
type DefinitionTreeInput = typeof customFieldDefinitionTreeSchema._type
type CreatePostSettingPayload = PostSettingCreateInput

type CustomFieldsTransform = (value: Prisma.JsonValue | Prisma.NullTypes.JsonNull | null | undefined) => {
  changed: boolean
  value: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull
}

const serializeDefinition = (node: DefinitionNode, includeChildren: boolean): CustomFieldDefinitionResponse => {
  const config = toPlainJson<Record<string, unknown>>(node.config) ?? null
  const validation = toPlainJson<Record<string, unknown>>(node.validation) ?? null

  return {
    id: node.id,
    postSettingId: node.postSettingId,
    parentId: node.parentId ?? null,
    type: node.type,
    slug: node.slug,
    label: node.label,
    description: node.description ?? null,
    isRepeatable: node.isRepeatable,
    config,
    validation,
    order: node.order,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    children: includeChildren ? node.children.map((child) => serializeDefinition(child, true)) : [],
  }
}

const serializePostSetting = (setting: PostSetting, tree?: DefinitionNode[] | null): PostSettingResponse => ({
  id: setting.id,
  name: setting.name,
  slug: setting.slug,
  status: setting.status,
  description: setting.description ?? null,
  createdAt: setting.createdAt.toISOString(),
  updatedAt: setting.updatedAt.toISOString(),
  definitions: tree ? tree.map((node) => serializeDefinition(node, true)) : undefined,
})

const flattenDefinitions = (nodes: DefinitionNode[]): DefinitionNode[] => {
  const result: DefinitionNode[] = []
  const walk = (node: DefinitionNode) => {
    result.push({ ...node, children: [] })
    node.children.forEach(walk)
  }
  nodes.forEach(walk)
  return result
}

const normalizeDefinitionInput = (definition: DefinitionTreeInput) => {
  const type = definition.type === 'repeatable' ? 'group' : definition.type
  const isRepeatable = definition.type === 'repeatable' ? true : Boolean(definition.isRepeatable)

  return {
    ...definition,
    type,
    isRepeatable,
    children: definition.children ?? [],
  }
}

const createDefinitionsForSetting = async (
  prisma: PrismaClient,
  postSettingId: string,
  definitions: DefinitionTreeInput[] | undefined,
  parentId: string | null = null
) => {
  if (!definitions || definitions.length === 0) {
    return
  }

  for (const [index, definition] of definitions.entries()) {
    const normalized = normalizeDefinitionInput(definition)
    const { children, order, ...rest } = normalized

    if (rest.isRepeatable && (!children || children.length !== 1)) {
      throw new HTTPException(400, {
        message: `${rest.label} の繰り返し設定には1件の子定義が必要です。`,
      })
    }

    const created = await createCustomFieldDefinition(prisma, {
      postSettingId,
      parentId,
      type: rest.type as ConfigSchemaType,
      slug: rest.slug,
      label: rest.label,
      description: rest.description,
      isRepeatable: rest.isRepeatable,
      order: order ?? index,
      validation: rest.validation,
      config: rest.config,
    })

    if (children && children.length > 0) {
      await createDefinitionsForSetting(prisma, postSettingId, children, created.id)
    }
  }
}

const applyCustomFieldsTransform = async (
  prisma: PrismaClient,
  postSettingId: string,
  transform: CustomFieldsTransform
) => {
  const posts = await prisma.post.findMany({
    where: { postSettingId },
    select: { id: true, customFields: true },
  })

  if (posts.length === 0) {
    return 0
  }

  const mutations: ReturnType<typeof prisma.post.update>[] = []

  for (const post of posts) {
    const { changed, value } = transform(post.customFields)
    if (changed) {
      mutations.push(
        prisma.post.update({
          where: { id: post.id },
          data: { customFields: value },
        })
      )
    }
  }

  if (mutations.length > 0) {
    await prisma.$transaction(mutations)
  }

  return mutations.length
}

const removeFieldValuesFromPosts = async (prisma: PrismaClient, postSettingId: string, slug: string) =>
  applyCustomFieldsTransform(prisma, postSettingId, (value) => removeFieldFromCustomFields(value, slug))

const renameFieldValuesInPosts = async (
  prisma: PrismaClient,
  postSettingId: string,
  oldSlug: string,
  newSlug: string
) => applyCustomFieldsTransform(prisma, postSettingId, (value) => renameFieldInCustomFields(value, oldSlug, newSlug))

const ensureUniqueOptions = (options: { label: string; value: string }[], fieldLabel: string) => {
  const seen = new Set<string>()
  for (const option of options) {
    const key = option.value.trim()
    if (seen.has(key)) {
      throw new HTTPException(400, {
        message: `${fieldLabel} の選択肢値「${key}」が重複しています。`,
      })
    }
    seen.add(key)
  }
}

const parseDefinitionConfig = (type: ConfigSchemaType, config: unknown, label: string) => {
  const schema = configSchemaByType[type]
  if (!schema) {
    if (config === undefined || config === null) {
      return null
    }
    if (typeof config === 'object' && config !== null && Object.keys(config as Record<string, unknown>).length === 0) {
      return null
    }
    throw new HTTPException(400, {
      message: `${label} に対して config を指定することはできません。`,
    })
  }

  try {
    const parsedResult = schema.safeParse(config ?? {})
    if (!parsedResult.success) {
      throw new HTTPException(400, {
        message: `${label} の config が不正です: ${parsedResult.error.issues
          .map((issue) => issue.message)
          .join(' / ')}`,
      })
    }
    const parsed = parsedResult.data as Record<string, unknown>
    if (type === 'select' || type === 'checkbox') {
      const rawOptions = parsed.options as { label: string; value: string }[] | undefined
      if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
        throw new HTTPException(400, {
          message: `${label} の選択肢を1件以上指定してください。`,
        })
      }
      ensureUniqueOptions(rawOptions, label)
    }
    return JSON.stringify(parsed) as Prisma.InputJsonValue
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(400, { message: `${label} の config が不正です。` })
  }
}

const parseDefinitionValidation = (validation: unknown) => {
  if (validation === undefined || validation === null) {
    return null
  }
  try {
    const parsed = customFieldValidationSchema.parse(validation)
    return JSON.stringify(parsed)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HTTPException(400, {
        message: `validation が不正です: ${error.issues.map((issue) => issue.message).join(' / ')}`,
      })
    }
    throw error
  }
}

const handlePrismaError = (
  error: unknown,
  notFoundMessage: string,
  duplicateMessage: string,
  constraintMessage?: string
) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      throw new HTTPException(404, { message: notFoundMessage })
    }
    if (error.code === 'P2002') {
      throw new HTTPException(409, { message: duplicateMessage })
    }
    if (error.code === 'P2003' && constraintMessage) {
      throw new HTTPException(409, { message: constraintMessage })
    }
  }
  throw error
}

export const listPostSettings = async (prisma: PrismaClient) => {
  const settings = await prisma.postSetting.findMany({
    include: {
      fieldDefinitions: {
        orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { slug: 'asc' }],
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return settings.map((setting) =>
    serializePostSetting(setting, buildDefinitionTree(setting.fieldDefinitions as unknown as DefinitionNode[]))
  )
}

export const getPostSettingById = async (prisma: PrismaClient, idOrSlug: string) => {
  const setting = await prisma.postSetting.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
  })

  if (!setting) {
    return null
  }

  const definitions = await prisma.customFieldDefinition.findMany({
    where: { postSettingId: setting.id },
    orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { slug: 'asc' }],
  })

  const tree = buildDefinitionTree(definitions as unknown as CustomFieldDefinition[])
  return serializePostSetting(setting, tree)
}

export const createPostSetting = async (prisma: PrismaClient, payload: CreatePostSettingPayload) => {
  try {
    const description =
      typeof payload.description === 'string' && payload.description.trim().length > 0
        ? payload.description.trim()
        : null

    const result = await prisma.$transaction(async (tx) => {
      const setting = await tx.postSetting.create({
        data: {
          name: payload.name,
          slug: payload.slug,
          status: payload.status,
          description,
        },
      })

      if (payload.definitions && payload.definitions.length > 0) {
        await createDefinitionsForSetting(tx, setting.id, payload.definitions)
      }

      const createdDefinitions =
        payload.definitions && payload.definitions.length > 0
          ? await tx.customFieldDefinition.findMany({
              where: { postSettingId: setting.id },
              orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { slug: 'asc' }],
            })
          : []

      return { setting, definitions: createdDefinitions }
    })

    const tree =
      result.definitions.length > 0
        ? buildDefinitionTree(result.definitions as unknown as CustomFieldDefinition[])
        : undefined

    return serializePostSetting(result.setting, tree)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    handlePrismaError(error, '投稿設定が見つかりません。', '同じスラッグの投稿設定が既に存在します。')
  }
}

export const updatePostSetting = async (
  prisma: PrismaClient,
  idOrSlug: string,
  payload: Partial<typeof postSettingResponseSchema._type>
) => {
  const existing = await prisma.postSetting.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
  })

  if (!existing) {
    throw new HTTPException(404, { message: '投稿設定が見つかりません。' })
  }

  try {
    const updated = await prisma.postSetting.update({
      where: { id: existing.id },
      data: {
        name: payload.name,
        slug: payload.slug,
        status: payload.status,
        description: payload.description,
      },
    })

    const definitions = await prisma.customFieldDefinition.findMany({
      where: { postSettingId: updated.id },
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { slug: 'asc' }],
    })

    return serializePostSetting(updated, buildDefinitionTree(definitions as unknown as CustomFieldDefinition[]))
  } catch (error) {
    handlePrismaError(error, '投稿設定が見つかりません。', '同じスラッグの投稿設定が既に存在します。')
  }
}

export const deletePostSetting = async (prisma: PrismaClient, idOrSlug: string) => {
  const existing = await prisma.postSetting.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
  })

  if (!existing) {
    throw new HTTPException(404, { message: '投稿設定が見つかりません。' })
  }

  if (existing.slug === 'post-default') {
    throw new HTTPException(409, { message: 'デフォルトテンプレートは削除できません。' })
  }

  const linkedPostCount = await prisma.post.count({ where: { postSettingId: existing.id } })
  if (linkedPostCount > 0) {
    throw new HTTPException(409, {
      message: 'この投稿設定を利用している投稿が存在するため削除できません。',
    })
  }

  try {
    await prisma.postSetting.delete({ where: { id: existing.id } })
  } catch (error) {
    handlePrismaError(
      error,
      '投稿設定が見つかりません。',
      '投稿設定の削除に失敗しました。',
      'この投稿設定を利用している投稿が存在するため削除できません。'
    )
  }
}

const assertParentAvailability = async (prisma: PrismaClient, postSettingId: string, parentId: string | null) => {
  if (!parentId) {
    return null
  }

  const parent = await prisma.customFieldDefinition.findUnique({ where: { id: parentId } })
  if (!parent || parent.postSettingId !== postSettingId) {
    throw new HTTPException(400, { message: '指定された親フィールドが存在しません。' })
  }
  return parent
}

const resolveOrder = async (prisma: PrismaClient, postSettingId: string, parentId: string | null, order?: number) => {
  if (order !== undefined) {
    return order
  }
  const last = await prisma.customFieldDefinition.findFirst({
    where: { postSettingId, parentId },
    orderBy: { order: 'desc' },
  })
  return (last?.order ?? -1) + 1
}

export const createCustomFieldDefinition = async (
  prisma: PrismaClient,
  payload: {
    postSettingId: string
    parentId?: string | null
    type: ConfigSchemaType
    slug: string
    label: string
    description?: string | null
    isRepeatable?: boolean
    order?: number
    validation?: unknown
    config?: unknown
  }
) => {
  await prisma.postSetting.findUnique({ where: { id: payload.postSettingId } }).then((setting) => {
    if (!setting) {
      throw new HTTPException(400, { message: '指定された投稿設定が存在しません。' })
    }
  })

  const parent = await assertParentAvailability(prisma, payload.postSettingId, payload.parentId ?? null)
  const order = await resolveOrder(prisma, payload.postSettingId, payload.parentId ?? parent?.id ?? null, payload.order)
  const validation = parseDefinitionValidation(payload.validation)
  const config = parseDefinitionConfig(payload.type, payload.config, payload.label)

  try {
    const created = await prisma.customFieldDefinition.create({
      data: {
        postSettingId: payload.postSettingId,
        parentId: payload.parentId ?? null,
        type: payload.type,
        slug: payload.slug.trim(),
        label: payload.label.trim(),
        description: payload.description?.trim() ?? null,
        isRepeatable: payload.isRepeatable ?? false,
        order,
        validation,
        config,
      },
    })

    return serializeDefinition({ ...created, children: [] } as DefinitionNode, false)
  } catch (error) {
    handlePrismaError(error, '投稿フィールド定義が見つかりません。', '同じスラッグのフィールド定義が既に存在します。')
  }
}

export const updateCustomFieldDefinition = async (
  prisma: PrismaClient,
  id: string,
  payload: {
    parentId?: string | null
    type?: ConfigSchemaType
    slug?: string
    label?: string
    description?: string | null
    isRepeatable?: boolean
    order?: number
    validation?: unknown
    config?: unknown
  }
) => {
  const existing = await prisma.customFieldDefinition.findUnique({ where: { id } })
  if (!existing) {
    throw new HTTPException(404, { message: '投稿フィールド定義が見つかりません。' })
  }

  if (payload.parentId === id) {
    throw new HTTPException(400, { message: '自分自身を親に指定することはできません。' })
  }

  if (payload.parentId !== undefined) {
    await assertParentAvailability(prisma, existing.postSettingId, payload.parentId ?? null)
  }

  const normalizedSlug = payload.slug?.trim()
  const slugChanged = normalizedSlug !== undefined && normalizedSlug.length > 0 && normalizedSlug !== existing.slug
  const typeChanged = payload.type !== undefined && payload.type !== existing.type
  const parentChanged = payload.parentId !== undefined && (payload.parentId ?? null) !== (existing.parentId ?? null)

  if (payload.type && payload.type !== existing.type && payload.config === undefined) {
    const requiresConfig = configSchemaByType[payload.type] !== null
    if (requiresConfig) {
      throw new HTTPException(400, {
        message: 'フィールドタイプを変更する場合は新しい config を指定してください。',
      })
    }
  }

  const nextType = payload.type ?? (existing.type as ConfigSchemaType)
  const nextParentId = payload.parentId !== undefined ? payload.parentId : existing.parentId
  const nextOrder =
    payload.order !== undefined
      ? payload.order
      : parentChanged
        ? await resolveOrder(prisma, existing.postSettingId, nextParentId, undefined)
        : existing.order

  const validation =
    payload.validation === undefined ? existing.validation : parseDefinitionValidation(payload.validation)

  const config =
    payload.config === undefined
      ? existing.config
      : parseDefinitionConfig(nextType, payload.config, payload.label ?? existing.label)

  try {
    const updated = await prisma.customFieldDefinition.update({
      where: { id },
      data: {
        parentId: payload.parentId === undefined ? undefined : (payload.parentId ?? null),
        type: payload.type,
        slug: payload.slug?.trim(),
        label: payload.label?.trim(),
        description: payload.description === undefined ? undefined : (payload.description?.trim() ?? null),
        isRepeatable: payload.isRepeatable,
        order: nextOrder,
        validation,
        config,
      },
    })

    if (typeChanged || parentChanged) {
      await removeFieldValuesFromPosts(prisma, existing.postSettingId, existing.slug)
    } else if (slugChanged) {
      await renameFieldValuesInPosts(prisma, existing.postSettingId, existing.slug, updated.slug)
    }

    return serializeDefinition({ ...updated, children: [] } as DefinitionNode, false)
  } catch (error) {
    handlePrismaError(error, '投稿フィールド定義が見つかりません。', '同じスラッグのフィールド定義が既に存在します。')
  }
}

export const deleteCustomFieldDefinition = async (prisma: PrismaClient, id: string) => {
  const existing = await prisma.customFieldDefinition.findUnique({
    where: { id },
    select: { id: true, postSettingId: true, slug: true },
  })

  if (!existing) {
    throw new HTTPException(404, { message: '投稿フィールド定義が見つかりません。' })
  }

  try {
    await prisma.customFieldDefinition.delete({ where: { id } })
  } catch (error) {
    handlePrismaError(error, '投稿フィールド定義が見つかりません。', '投稿フィールド定義の削除に失敗しました。')
  }

  await removeFieldValuesFromPosts(prisma, existing.postSettingId, existing.slug)
}

export const reorderCustomFieldDefinitions = async (
  prisma: PrismaClient,
  reorderPayload: { id: string; order: number }[]
) => {
  if (reorderPayload.length === 0) {
    return
  }

  await prisma.$transaction(
    reorderPayload.map((item) =>
      prisma.customFieldDefinition.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    )
  )
}
