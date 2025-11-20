import type { Category, CustomFieldDefinition, Post, PostSetting, PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import xss from 'xss'
import { createAuditLog } from '../utils/auditLog'
import { type DefinitionNode, buildDefinitionTree, validateCustomFieldsPayload } from './customFieldHelpers'

type PostWithCategory = Post & { category?: Category | null; postSetting?: PostSetting | null }

type CreatePostInput = {
  title: string
  categoryId?: string
  publishedAt?: string
  postedAt?: string
  status?: PostStatusType
  postSettingId: string
  detailSlug?: string | null
  detailBody?: string | null
  detailEnabled?: boolean
  customFields?: string
  usedFallback: boolean
}

type UpdatePostInput = {
  title?: string
  categoryId?: string
  publishedAt?: string
  postedAt?: string
  status?: PostStatusType
  postSettingId?: string
  detailSlug?: string | null
  detailBody?: string | null
  detailEnabled?: boolean
  customFields?: string
  usedFallback: boolean
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

type PublicCustomFieldDefinition = {
  id: string
  type: string
  slug: string
  label: string
  description: string | null
  config: Record<string, unknown> | null
  validation: Record<string, unknown> | null
  children: PublicCustomFieldDefinition[]
}

type PublicCustomFieldSet = {
  id: string
  name: string
  slug: string
  definitions: PublicCustomFieldDefinition[]
}

type PublicPostPayload = {
  id: string
  postSettingId: string
  postSettingName: string | null
  postSettingSlug: string | null
  title: string
  categoryId: string | null
  categoryName: string | null
  detailEnabled: boolean
  detailSlug: string | null
  detailBody: string | null
  publishedAt: string | null
  postedAt: string | null
  status: PostStatusType
  customFields: Record<string, unknown> | null
  customFieldSet: PublicCustomFieldSet | null
  createdAt: string
  updatedAt: string
}

const parseJsonColumn = <T>(value: string | null | undefined): T | null => {
  if (!value) {
    return null
  }
  try {
    const parsed = JSON.parse(value) as T
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

const mapDefinitionForPublic = (node: DefinitionNode): PublicCustomFieldDefinition => {
  const type = node.isRepeatable ? 'repeatable' : node.type
  return {
    id: node.id,
    type,
    slug: node.slug,
    label: node.label,
    description: node.description ?? null,
    config: parseJsonColumn<Record<string, unknown>>(node.config ?? null),
    validation: parseJsonColumn<Record<string, unknown>>(node.validation ?? null),
    children: node.children.map(mapDefinitionForPublic),
  }
}

const buildPublicCustomFieldSet = (
  postSetting?: (PostSetting & { fieldDefinitions: CustomFieldDefinition[] }) | null
): PublicCustomFieldSet | null => {
  if (!postSetting) {
    return null
  }

  const definitions =
    postSetting.fieldDefinitions && postSetting.fieldDefinitions.length > 0
      ? buildDefinitionTree(postSetting.fieldDefinitions)
      : []

  return {
    id: postSetting.id,
    name: postSetting.name,
    slug: postSetting.slug,
    definitions: definitions.map(mapDefinitionForPublic),
  }
}

const parseCustomFieldsPayload = (raw: string | null | undefined): Record<string, unknown> | null => {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

const mapPostToPublicPayload = (
  post: Post & {
    category: Category | null
    postSetting: (PostSetting & { fieldDefinitions: CustomFieldDefinition[] }) | null
  },
  env: {
    CLOUDFLARE_ACCOUNT_ID?: string
    CLOUDFLARE_R2_BUCKET?: string
    CLOUDFLARE_R2_PUBLIC_BASE_URL?: string
  }
): PublicPostPayload => {
  const processedDetailBody = normalizeColorSpans(replaceR2UrlsInContents(post.detailBody ?? null, env))

  return {
    id: post.id,
    postSettingId: post.postSettingId,
    postSettingName: post.postSetting?.name ?? null,
    postSettingSlug: post.postSetting?.slug ?? null,
    title: post.title,
    categoryId: post.categoryId ?? null,
    categoryName: post.category?.name ?? null,
    detailEnabled: post.detailEnabled ?? false,
    detailSlug: post.detailSlug ?? null,
    detailBody: processedDetailBody,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    postedAt: post.postedAt ? post.postedAt.toISOString() : null,
    status: post.status as PostStatusType,
    customFields: parseCustomFieldsPayload(post.customFields),
    customFieldSet: buildPublicCustomFieldSet(post.postSetting),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }
}

const escapeRegexFragment = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const repairLegacyColorSpans = (html: string) =>
  html.replace(/<span\s+#([0-9a-f]{3,8})([^>]*)>/gi, (_match, hex, rest) => {
    const color = `#${String(hex).trim()}`
    const cleaned = rest.replace(/\scolor:\s*[^>\s;]+;?/gi, ' ').trim()
    const otherAttrs = cleaned.length > 0 ? ` ${cleaned}` : ''
    return `<span${otherAttrs} style="color:${color};" data-color="${color}">`
  })

const collapseNestedColorSpans = (input: string) => {
  if (typeof input !== 'string' || input.length === 0) {
    return input
  }
  let previous = input
  let current = input
  const pattern = /<span>\s*(<span[^>]*data-color[^>]*>[\s\S]*?<\/span>)\s*<\/span>/gi
  do {
    previous = current
    current = current.replace(pattern, '$1')
  } while (current !== previous)
  return current
}

const normalizeColorSpans = (input: string | null | undefined): string | null => {
  if (typeof input !== 'string') {
    return input ?? null
  }
  if (input.length === 0) {
    return input
  }

  const repaired = repairLegacyColorSpans(input)
  const normalized = collapseNestedColorSpans(
    repaired.replace(/<span([^>]*)>/gi, (match, rawAttributes) => {
      const attributes = rawAttributes ?? ''
      const styleMatch = attributes.match(/style\s*=\s*"([^"]*)"/i)
      const dataColorMatch = attributes.match(/data-color\s*=\s*"([^"]*)"/i)

      let remaining = attributes
      let styleValue = styleMatch?.[1] ?? ''
      let color = dataColorMatch?.[1]?.trim() ?? null

      if (styleMatch) {
        remaining = remaining.replace(styleMatch[0], ' ')
      }
      if (dataColorMatch) {
        remaining = remaining.replace(dataColorMatch[0], ' ')
      }

      if (!color && styleValue) {
        const colorFromStyle = styleValue.match(/color\s*:\s*([^;]+)(;|$)/i)
        if (colorFromStyle) {
          color = colorFromStyle[1].trim()
        }
      }

      if (!color) {
        const hexToken = remaining.match(/#([0-9a-f]{3,8})\b/i)
        if (hexToken) {
          color = `#${hexToken[1]}`
          remaining = remaining.replace(hexToken[0], ' ')
        }
      }

      if (!color) {
        return match
      }

      const normalizedColor = color

      const styleSegments = styleValue
        ? styleValue
            .split(';')
            .map((segment) => segment.trim())
            .filter(Boolean)
            .filter((segment) => !/^color\s*:/i.test(segment))
        : []

      styleSegments.push(`color: ${normalizedColor}`)
      let normalizedStyle = styleSegments.join('; ')
      if (!normalizedStyle.endsWith(';')) {
        normalizedStyle = `${normalizedStyle};`
      }

      const otherAttrs = remaining.replace(/\s{2,}/g, ' ').trim()
      const attributeParts = [otherAttrs, `style="${normalizedStyle}"`, `data-color="${normalizedColor}"`]
        .filter((segment) => segment && segment.length > 0)
        .join(' ')

      return `<span${attributeParts.length > 0 ? ` ${attributeParts}` : ''}>`
    })
  )

  return normalized
}

const sanitizeRichText = (html: string) => {
  // xssを完全にバイパスして、独自のサニタイズを行う
  // 危険なタグを除去するだけのシンプルな処理
  const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed']
  let sanitized = html

  // 危険なタグを除去
  for (const tag of dangerousTags) {
    const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>|<${tag}[^>]*/>`, 'gi')
    sanitized = sanitized.replace(regex, '')
  }

  // 危険な属性を除去
  sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '')
  sanitized = sanitized.replace(/javascript:[^"']*/gi, '')

  return normalizeColorSpans(sanitized)
}

const parsePublishedAt = (value: string) => {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      throw new Error('invalid date')
    }
    return date
  } catch {
    throw new HTTPException(400, { message: '公開日の形式が不正です。' })
  }
}

const parseOptionalDate = (value: string | undefined, fieldLabel: string) => {
  if (!value) {
    return undefined
  }
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      throw new Error('invalid date')
    }
    return date
  } catch {
    throw new HTTPException(400, { message: `${fieldLabel}の形式が不正です。` })
  }
}

type PostStatusType = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

const deriveStatus = (
  explicit: CreatePostInput['status'] | UpdatePostInput['status'],
  publishedAt: Date | null,
  previous?: PostStatusType
): PostStatusType => {
  if (explicit) {
    return explicit
  }
  if (previous) {
    if (previous === 'ARCHIVED') {
      return previous
    }
    if (publishedAt && previous === 'DRAFT') {
      return 'PUBLISHED'
    }
    if (!publishedAt && previous === 'PUBLISHED') {
      return 'DRAFT'
    }
    return previous
  }
  return publishedAt ? 'PUBLISHED' : 'DRAFT'
}

const DETAIL_SLUG_REGEX = /^[a-z0-9-]+$/

const normalizeDetailSlug = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (!DETAIL_SLUG_REGEX.test(trimmed)) {
    throw new HTTPException(400, { message: '詳細ページのslugは半角英数字とハイフンのみ利用できます。' })
  }
  if (trimmed.length < 3 || trimmed.length > 120) {
    throw new HTTPException(400, { message: '詳細ページのslugは3文字以上120文字以内で入力してください。' })
  }
  return trimmed
}

const formatPost = (post: PostWithCategory) => ({
  id: post.id,
  postSettingId: post.postSettingId,
  postSettingName: post.postSetting?.name ?? null,
  title: post.title,
  categoryId: post.categoryId ?? null,
  categoryName: post.category?.name ?? null,
  detailEnabled: post.detailEnabled ?? false,
  detailSlug: post.detailSlug ?? null,
  detailBody: normalizeColorSpans(post.detailBody),
  publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
  postedAt: post.postedAt ? post.postedAt.toISOString() : null,
  status: post.status as PostStatusType,
  customFields: post.customFields ?? null,
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
  createdByUserId: post.createdByUserId ?? null,
  updatedByUserId: post.updatedByUserId ?? null,
})

const resolveUserId = (c: Context): number | undefined => {
  const user = c.get('user') as { userId?: number } | undefined
  return typeof user?.userId === 'number' ? user.userId : undefined
}

type ListPostFilters = {
  postSettingId?: string
  keyword?: string
  title?: string
  categoryId?: string | null
  status?: PostStatusType
  detailEnabled?: boolean
}

export const listPosts = async (prisma: PrismaClient, filters: ListPostFilters = {}) => {
  const where: Prisma.PostWhereInput = {}

  if (filters.postSettingId) {
    where.postSettingId = filters.postSettingId
  }

  if (filters.title) {
    where.title = {
      contains: filters.title,
    }
  }

  if (filters.categoryId !== undefined) {
    where.categoryId = filters.categoryId
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (typeof filters.detailEnabled === 'boolean') {
    where.detailEnabled = filters.detailEnabled
  }

  const posts = await prisma.post.findMany({
    where,
    include: { category: true, postSetting: true },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })
  const formatted = posts.map(formatPost)

  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase()
    return formatted.filter((post) => {
      const customFieldsSource = (() => {
        if (post.customFields === null || post.customFields === undefined) {
          return ''
        }
        if (typeof post.customFields === 'string') {
          return post.customFields
        }
        try {
          return JSON.stringify(post.customFields)
        } catch {
          return String(post.customFields)
        }
      })()

      const haystack = [post.title, post.detailBody ?? '', customFieldsSource].join(' ').toLowerCase()

      return haystack.includes(keyword)
    })
  }

  return formatted
}

export const getPostById = async (prisma: PrismaClient, id: string) => {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { category: true, postSetting: true },
  })
  return post ? formatPost(post) : null
}

export const createPost = async (prisma: PrismaClient, c: Context, input: CreatePostInput) => {
  const userId = resolveUserId(c)
  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } })
    if (!category) {
      throw new HTTPException(400, { message: '指定されたカテゴリが存在しません。' })
    }
  }

  const postSetting = input.usedFallback
    ? await prisma.postSetting.findUnique({ where: { slug: 'post-default' } })
    : await prisma.postSetting.findUnique({ where: { id: input.postSettingId } })
  if (!postSetting) {
    if (input.postSettingId === 'post-default') {
      // 既定テンプレートが存在しない
      throw new HTTPException(424, { message: '既定の投稿設定が見つかりません。システム管理者に連絡してください。' })
    }
    // ユーザーが指定したテンプレートが存在しない
    throw new HTTPException(404, { message: '指定された投稿設定が存在しません。' })
  }

  if (postSetting.status === 'INACTIVE') {
    if (input.postSettingId === 'post-default') {
      // 既定テンプレートが無効
      throw new HTTPException(409, { message: '既定の投稿設定が無効です。システム管理者に連絡してください。' })
    }
    // ユーザーが指定したテンプレートが無効
    throw new HTTPException(409, { message: '無効化された投稿設定は使用できません。' })
  }

  const sanitizedTitle = input.title.trim()
  const publishedAt = input.publishedAt ? parsePublishedAt(input.publishedAt) : null
  const postedAt = parseOptionalDate(input.postedAt, '投稿日') ?? publishedAt ?? new Date()

  const data: Parameters<PrismaClient['post']['create']>[0]['data'] = {
    title: sanitizedTitle,
    categoryId: input.categoryId,
    publishedAt,
    postedAt,
    status: deriveStatus(input.status, publishedAt),
    postSettingId: postSetting.id,
    createdByUserId: userId,
    updatedByUserId: userId,
  }

  const validatedCustomFields = await validateCustomFieldsPayload(prisma, postSetting.id, input.customFields)
  data.customFields = validatedCustomFields

  const rawDetailBody = typeof input.detailBody === 'string' ? input.detailBody.trim() : ''
  const sanitizedDetailBody = rawDetailBody.length > 0 ? sanitizeRichText(rawDetailBody) : null

  data.detailBody = sanitizedDetailBody

  const detailEnabled = input.detailEnabled ?? false
  const normalizedDetailSlug = normalizeDetailSlug(input.detailSlug)

  data.detailEnabled = detailEnabled
  data.detailSlug = data.detailEnabled ? normalizedDetailSlug : null

  if (data.detailEnabled && !data.detailSlug) {
    throw new HTTPException(400, { message: '詳細ページを生成する場合はslugを指定してください。' })
  }

  const newPost = await prisma.post.create({
    data,
    include: { category: true, postSetting: true },
  })

  await createAuditLog(prisma, c, 'POST_CREATED', userId, {
    postId: newPost.id,
    title: newPost.title,
    categoryId: newPost.categoryId,
    publishedAt: publishedAt?.toISOString(),
    detailEnabled: data.detailEnabled ?? false,
    status: data.status,
    usedFallback: input.usedFallback,
  })

  return formatPost(newPost)
}

export const updatePost = async (prisma: PrismaClient, c: Context, id: string, input: UpdatePostInput) => {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { category: true },
  })

  if (!existing) {
    throw new HTTPException(404, { message: '投稿が見つかりません。' })
  }

  const userId = resolveUserId(c)

  const data: Parameters<PrismaClient['post']['update']>[0]['data'] = {}

  if (typeof input.title === 'string') {
    data.title = input.title.trim()
  }

  if (input.categoryId !== undefined) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } })
    if (!category) {
      throw new HTTPException(400, { message: '指定されたカテゴリが存在しません。' })
    }
    data.categoryId = input.categoryId
  }

  let nextPublishedAt = existing.publishedAt ?? null
  if (input.publishedAt !== undefined) {
    nextPublishedAt = parsePublishedAt(input.publishedAt)
    data.publishedAt = nextPublishedAt
  }

  let nextPostedAt = existing.postedAt
  if (input.postedAt !== undefined) {
    nextPostedAt = parseOptionalDate(input.postedAt, '投稿日') ?? existing.postedAt
    data.postedAt = nextPostedAt
  }

  const nextStatus = deriveStatus(input.status, nextPublishedAt, existing.status as PostStatusType)
  data.status = nextStatus

  if (input.postSettingId !== undefined) {
    const nextPostSetting = input.usedFallback
      ? await prisma.postSetting.findUnique({ where: { slug: 'post-default' } })
      : await prisma.postSetting.findUnique({ where: { id: input.postSettingId } })
    if (!nextPostSetting) {
      if (input.postSettingId === 'post-default') {
        throw new HTTPException(424, { message: '既定の投稿設定が見つかりません。システム管理者に連絡してください。' })
      }
      throw new HTTPException(404, { message: '指定された投稿設定が存在しません。' })
    }
    if (nextPostSetting.status === 'INACTIVE') {
      if (input.postSettingId === 'post-default') {
        throw new HTTPException(409, { message: '既定の投稿設定が無効です。システム管理者に連絡してください。' })
      }
      if (nextPostSetting.id !== existing.postSettingId) {
        throw new HTTPException(409, { message: '無効化された投稿設定は選択できません。' })
      }
    }
    if (nextPostSetting.id !== existing.postSettingId && input.customFields === undefined) {
      throw new HTTPException(400, {
        message: '投稿設定を変更する場合はカスタムフィールドを再入力してください。',
      })
    }
    data.postSettingId = nextPostSetting.id
  }

  if (userId !== undefined) {
    data.updatedByUserId = userId
  }

  let resolvedDetailBody: string | null
  if (input.detailBody !== undefined) {
    if (input.detailBody === null) {
      resolvedDetailBody = null
    } else {
      const trimmed = input.detailBody.trim()
      console.log('[api] rawDetailBody:', trimmed)
      resolvedDetailBody = trimmed.length > 0 ? sanitizeRichText(trimmed) : null
      console.log('[api] sanitizedDetailBody:', resolvedDetailBody)
    }
  } else {
    resolvedDetailBody = existing.detailBody
  }
  data.detailBody = resolvedDetailBody ?? null

  const desiredDetailEnabled = input.detailEnabled ?? existing.detailEnabled ?? false
  let resolvedDetailEnabled = desiredDetailEnabled

  let resolvedDetailSlug =
    input.detailSlug !== undefined ? normalizeDetailSlug(input.detailSlug) : (existing.detailSlug ?? null)
  if (!resolvedDetailEnabled) {
    resolvedDetailSlug = null
  }
  if (resolvedDetailEnabled && !resolvedDetailSlug) {
    throw new HTTPException(400, { message: '詳細ページを生成する場合はslugを指定してください。' })
  }
  data.detailSlug = resolvedDetailSlug
  data.detailEnabled = resolvedDetailEnabled

  const effectivePostSettingId = (data.postSettingId as string | undefined) ?? existing.postSettingId
  if (input.customFields !== undefined) {
    data.customFields = await validateCustomFieldsPayload(prisma, effectivePostSettingId, input.customFields)
  }

  const updated = await prisma.post.update({
    where: { id },
    data,
    include: { category: true, postSetting: true },
  })

  await createAuditLog(prisma, c, 'POST_UPDATED', userId, {
    postId: updated.id,
    changes: {
      titleChanged: data.title !== undefined && data.title !== existing.title,
      categoryChanged: data.categoryId !== undefined && data.categoryId !== existing.categoryId,
      publishedAtChanged:
        data.publishedAt !== undefined && data.publishedAt?.toISOString() !== existing.publishedAt?.toISOString(),
      detailEnabledChanged:
        data.detailEnabled !== undefined && data.detailEnabled !== (existing.detailEnabled ?? false),
      postSettingChanged: data.postSettingId !== undefined && data.postSettingId !== existing.postSettingId,
      statusChanged: data.status !== undefined && data.status !== (existing.status as PostStatusType),
      detailSlugChanged: data.detailSlug !== undefined && data.detailSlug !== (existing.detailSlug ?? null),
    },
    usedFallback: input.usedFallback,
  })

  return updated
}

export const deletePost = async (prisma: PrismaClient, c: Context, id: string) => {
  const existing = await prisma.post.findUnique({
    where: { id },
    include: { category: true },
  })

  if (!existing) {
    throw new HTTPException(404, { message: '投稿が見つかりません。' })
  }

  const userId = resolveUserId(c)
  await prisma.post.delete({ where: { id } })

  await createAuditLog(prisma, c, 'POST_DELETED', userId, {
    postId: existing.id,
    title: existing.title,
    categoryId: existing.categoryId ?? null,
  })
}

const replaceR2UrlsInContents = (
  contents: string | null,
  env: {
    CLOUDFLARE_ACCOUNT_ID?: string
    CLOUDFLARE_R2_BUCKET?: string
    CLOUDFLARE_R2_PUBLIC_BASE_URL?: string
  }
) => {
  if (!contents) {
    return null
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const bucketName = env.CLOUDFLARE_R2_BUCKET
  const publicBaseUrl = env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.replace(/\/+$/, '')

  if (!accountId || !bucketName || !publicBaseUrl) {
    return contents
  }

  const r2InternalUrlPattern = new RegExp(
    `https://${escapeRegexFragment(accountId)}\\.r2\\.cloudflarestorage\\.com/${escapeRegexFragment(bucketName)}/`,
    'g'
  )

  return contents.replace(r2InternalUrlPattern, `${publicBaseUrl}/`)
}

export const listPublicPosts = async (prisma: PrismaClient, c: Context) => {
  const now = new Date()
  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: {
        lte: now,
      },
    },
    include: {
      category: true,
      postSetting: {
        include: {
          fieldDefinitions: {
            orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { slug: 'asc' }],
          },
        },
      },
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })

  const env = c.get('validatedEnv') as {
    CLOUDFLARE_ACCOUNT_ID?: string
    CLOUDFLARE_R2_BUCKET?: string
    CLOUDFLARE_R2_PUBLIC_BASE_URL?: string
  }

  return posts.map((post) => mapPostToPublicPayload(post, env))
}

export const getPublicPostById = async (prisma: PrismaClient, c: Context, idOrSlug: string) => {
  const now = new Date()

  let post = await prisma.post.findFirst({
    where: {
      id: idOrSlug,
      status: 'PUBLISHED',
      publishedAt: {
        lte: now,
      },
    },
    include: {
      category: true,
      postSetting: {
        include: {
          fieldDefinitions: {
            orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { slug: 'asc' }],
          },
        },
      },
    },
  })

  if (!post) {
    post = await prisma.post.findFirst({
      where: {
        detailSlug: idOrSlug,
        status: 'PUBLISHED',
        publishedAt: {
          lte: now,
        },
      },
      include: {
        category: true,
        postSetting: {
          include: {
            fieldDefinitions: {
              orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { slug: 'asc' }],
            },
          },
        },
      },
    })
  }

  if (!post) {
    return null
  }

  const env = c.get('validatedEnv') as {
    CLOUDFLARE_ACCOUNT_ID?: string
    CLOUDFLARE_R2_BUCKET?: string
    CLOUDFLARE_R2_PUBLIC_BASE_URL?: string
  }

  return mapPostToPublicPayload(post, env)
}
