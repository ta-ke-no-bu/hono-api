import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

const categoryIdSchema = z.string().min(1, 'カテゴリIDは必須です。')
const postSettingIdSchema = z.string().min(1, '投稿設定IDは必須です。')

const optionalFilterString = z.string().trim().min(1)

const detailEnabledFilterSchema = z.enum(['true', 'false']).transform((value) => value === 'true')

export const postListQuerySchema = z
  .object({
    postSettingId: postSettingIdSchema.optional(),
    keyword: optionalFilterString.max(120).optional(),
    title: optionalFilterString.max(120).optional(),
    categoryId: optionalFilterString.optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    detailEnabled: detailEnabledFilterSchema.optional(),
  })
  .openapi('PostListQuery')

const basePostSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  postSettingId: postSettingIdSchema,
  postSettingName: z.string().nullable(),
  categoryId: categoryIdSchema.nullable(),
  categoryName: z.string().nullable(),
  detailEnabled: z.boolean(),
  detailSlug: z.string().nullable(),
  detailBody: z.string().nullable(),
  publishedAt: z.string().datetime().nullable(),
  postedAt: z.string().datetime().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  customFields: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const postResponseSchema = basePostSchema
  .extend({
    createdByUserId: z.number().int().nullable().optional(),
    updatedByUserId: z.number().int().nullable().optional(),
  })
  .openapi('PostResponse')

export const postListResponseSchema = z.array(postResponseSchema).openapi('PostListResponse')

const publicCustomFieldDefinitionSchema: z.ZodType<{
  id: string
  type: string
  slug: string
  label: string
  description: string | null
  config?: Record<string, unknown> | null
  validation?: Record<string, unknown> | null
  children?: unknown
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    slug: z.string(),
    label: z.string(),
    description: z.string().nullable(),
    config: z.record(z.string(), z.any()).nullable().optional(),
    validation: z.record(z.string(), z.any()).nullable().optional(),
    children: z.array(publicCustomFieldDefinitionSchema).optional(),
  })
)

const publicCustomFieldSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  definitions: z.array(publicCustomFieldDefinitionSchema),
})

const publicPostSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  postSettingId: postSettingIdSchema,
  postSettingName: z.string().nullable(),
  postSettingSlug: z.string().nullable(),
  categoryId: categoryIdSchema.nullable(),
  categoryName: z.string().nullable(),
  detailEnabled: z.boolean(),
  detailSlug: z.string().nullable(),
  detailBody: z.string().nullable(),
  publishedAt: z.string().datetime().nullable(),
  postedAt: z.string().datetime().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  customFields: z.record(z.string(), z.any()).nullable(),
  customFieldSet: publicCustomFieldSetSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const postPublicResponseSchema = publicPostSchema.openapi('PostPublicResponse')

export const postPublicListResponseSchema = z.array(publicPostSchema).openapi('PostPublicListResponse')

const titleSchema = z
  .string()
  .trim()
  .min(1, 'タイトルは必須です。')
  .max(120, 'タイトルは120文字以内で入力してください。')

const publishedAtSchema = z.string().trim().datetime({ message: '公開日はISO8601形式で指定してください。' })

const detailContentsSchema = z
  .string()
  .trim()
  .min(1, '詳細本文を入力してください。')
  .max(20000, '詳細本文は20000文字以内で入力してください。')

export const postCreateSchema = z
  .object({
    title: titleSchema,
    categoryId: categoryIdSchema.optional(),
    publishedAt: publishedAtSchema.optional(),
    postedAt: z.string().datetime().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    postSettingId: z.string().optional(),
    detailBody: z.union([detailContentsSchema, z.null()]).optional(),
    detailEnabled: z.boolean().optional(),
    detailSlug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'slugは半角英数字とハイフンのみ利用できます。')
      .optional(),
    customFields: z.string().optional(),
  })
  .transform((data) => {
    const usedFallback = !data.postSettingId
    return {
      ...data,
      postSettingId: data.postSettingId || 'post-default',
      usedFallback,
    }
  })
  .superRefine((data, ctx) => {
    const detailSlugProvided = typeof data.detailSlug === 'string' && data.detailSlug.trim().length > 0

    if (data.detailEnabled && !detailSlugProvided) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '詳細ページを生成する場合はslugを入力してください。',
        path: ['detailSlug'],
      })
    }
    if (data.status === 'PUBLISHED' && !data.publishedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '公開状態にする場合は公開日を指定してください。',
        path: ['publishedAt'],
      })
    }
  })
  .openapi('PostCreateRequest')

export const postUpdateSchema = z
  .object({
    title: titleSchema.optional(),
    categoryId: categoryIdSchema.optional(),
    publishedAt: publishedAtSchema.optional(),
    postedAt: z.string().datetime().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    postSettingId: z.string().optional(),
    detailBody: z.union([detailContentsSchema, z.null()]).optional(),
    detailEnabled: z.boolean().optional(),
    detailSlug: z
      .union([z.string().regex(/^[a-z0-9-]+$/, 'slugは半角英数字とハイフンのみ利用できます。'), z.null()])
      .optional(),
    customFields: z.string().optional(),
  })
  .transform((data) => {
    const usedFallback = data.postSettingId === ''
    return {
      ...data,
      postSettingId: usedFallback ? 'post-default' : data.postSettingId,
      usedFallback,
    }
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: '更新内容が指定されていません。',
    path: ['title'],
  })
  .superRefine((data, ctx) => {
    if (data.detailEnabled === true) {
      const slugProvided =
        typeof data.detailSlug === 'string'
          ? data.detailSlug.trim().length > 0
          : data.detailSlug !== null && data.detailSlug !== undefined
      if (!slugProvided) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '詳細ページを生成する場合はslugを入力してください。',
          path: ['detailSlug'],
        })
      }
    }
    if (data.status === 'PUBLISHED' && data.publishedAt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '公開状態に変更する場合は公開日を指定してください。',
        path: ['publishedAt'],
      })
    }
  })
  .openapi('PostUpdateRequest')

export const postIdParamSchema = z.object({
  id: z.string().min(1),
})
