import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

const categoryIdSchema = z.string().min(1, 'カテゴリIDは必須です。')
const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'カテゴリ名は必須です。')
  .max(60, 'カテゴリ名は60文字以内で入力してください。')

const categorySlugSchema = z
  .string()
  .trim()
  .min(1, 'スラッグは1文字以上で入力してください。')
  .max(80, 'スラッグは80文字以内で入力してください。')
  .regex(/^[a-z0-9-]+$/i, 'スラッグは英数字とハイフンのみ使用できます。')

export const categoryResponseSchema = z
  .object({
    id: categoryIdSchema,
    name: categoryNameSchema,
    slug: categorySlugSchema.nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('CategoryResponse')

export const categoryListResponseSchema = z.array(categoryResponseSchema).openapi('CategoryListResponse')

export const categoryCreateSchema = z
  .object({
    name: categoryNameSchema,
    slug: categorySlugSchema.optional(),
  })
  .openapi('CategoryCreateRequest')

export const categoryUpdateSchema = z
  .object({
    name: categoryNameSchema.optional(),
    slug: categorySlugSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: '更新内容が指定されていません。',
    path: ['name'],
  })
  .openapi('CategoryUpdateRequest')

export const categoryIdParamSchema = z.object({
  id: categoryIdSchema,
})
