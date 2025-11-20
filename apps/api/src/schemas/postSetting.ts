import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

const slugPattern = /^[a-z0-9-]+([a-z0-9-]*[a-z0-9])?$/

export const postSettingStatusSchema = z.enum(['ACTIVE', 'INACTIVE']).openapi({ description: '投稿設定の状態' })

export const customFieldTypeSchema = z
  .enum(['text', 'richText', 'date', 'file', 'select', 'checkbox', 'group', 'repeatable'])
  .openapi({ description: '投稿設定フィールドの型' })

export const customFieldValidationSchema = z
  .object({
    required: z.boolean().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(0).optional(),
    minItems: z.number().int().min(0).optional(),
    maxItems: z.number().int().min(0).optional(),
  })
  .partial()
  .refine(
    (data) => {
      if (data.minLength !== undefined && data.maxLength !== undefined) {
        return data.minLength <= data.maxLength
      }
      return true
    },
    { message: 'minLength は maxLength 以下である必要があります。' }
  )
  .refine(
    (data) => {
      if (data.minItems !== undefined && data.maxItems !== undefined) {
        return data.minItems <= data.maxItems
      }
      return true
    },
    { message: 'minItems は maxItems 以下である必要があります。' }
  )

const basePostSettingSchema = z.object({
  name: z.string().trim().min(1, '名称は必須です。').max(120, '名称は120文字以内で入力してください。'),
  slug: z
    .string()
    .trim()
    .min(1, 'スラッグは必須です。')
    .max(64, 'スラッグは64文字以内で入力してください。')
    .regex(slugPattern, 'スラッグは半角英数字とハイフンのみ利用できます。'),
  status: postSettingStatusSchema.default('ACTIVE'),
  description: z.string().trim().max(500).optional(),
})

export const postSettingUpdateSchema = basePostSettingSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: '更新内容が指定されていません。',
  })
  .openapi('PostSettingUpdateRequest')

export const selectOptionSchema = z
  .object({
    label: z.string().trim().min(1, 'ラベルは必須です。').max(120),
    value: z.string().trim().min(1, '値は必須です。').max(120),
  })
  .strict()

export const textConfigSchema = z.object({ multiline: z.boolean().optional() }).strict()
export const richTextConfigSchema = z
  .object({ toolbarPreset: z.string().optional(), placeholder: z.string().optional() })
  .strict()
export const dateConfigSchema = z.object({ mode: z.enum(['date', 'datetime']).optional() }).strict()
export const fileConfigSchema = z.object({ accept: z.array(z.string()).optional() }).strict()
export const selectConfigSchema = z.object({ options: z.array(selectOptionSchema) }).strict()
export const checkboxConfigSchema = z
  .object({
    options: z.array(selectOptionSchema),
    maxSelections: z.number().int().min(1).optional(),
  })
  .strict()

const customFieldBaseSchema = z.object({
  postSettingId: z.string().trim().min(1, '投稿設定IDは必須です。').optional(),
  parentId: z.string().cuid().nullable().optional(),
  type: customFieldTypeSchema,
  slug: z
    .string()
    .trim()
    .min(1, 'スラッグは必須です。')
    .max(64, 'スラッグは64文字以内で入力してください。')
    .regex(slugPattern, 'スラッグは半角英数字とハイフンのみ利用できます。'),
  label: z.string().trim().min(1, 'ラベルは必須です。').max(120),
  description: z.string().trim().max(500).nullable().optional(),
  isRepeatable: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  validation: customFieldValidationSchema.optional(),
  config: z.unknown().optional(),
})

export const customFieldDefinitionCreateSchema = customFieldBaseSchema.openapi('CustomFieldDefinitionCreateRequest')

const customFieldDefinitionTreeBaseSchema = customFieldDefinitionCreateSchema
  .omit({ postSettingId: true, parentId: true })
  .extend({
    order: z.number().int().min(0).optional(),
  })

export const customFieldDefinitionTreeSchema: z.ZodType<
  Omit<typeof customFieldDefinitionCreateSchema._type, 'postSettingId' | 'parentId'> & {
    children?: (typeof customFieldDefinitionTreeSchema._type)[]
  }
> = z.lazy(() =>
  customFieldDefinitionTreeBaseSchema.extend({
    children: z.array(customFieldDefinitionTreeSchema).optional(),
  })
)

export const postSettingCreateSchema = basePostSettingSchema
  .extend({
    definitions: z.array(customFieldDefinitionTreeSchema).optional(),
  })
  .openapi('PostSettingCreateRequest')

export const customFieldDefinitionUpdateSchema = customFieldBaseSchema
  .omit({ postSettingId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: '更新内容が指定されていません。',
  })
  .openapi('CustomFieldDefinitionUpdateRequest')

export const customFieldDefinitionReorderSchema = z
  .object({
    id: z.string().cuid(),
    order: z.number().int().min(0),
  })
  .openapi('CustomFieldDefinitionReorderRequest')

export const postSettingIdParamSchema = z.object({
  id: z.string().min(1, 'IDは必須です').openapi({ description: '投稿設定のIDまたはスラッグ' }),
})

export const customFieldDefinitionIdParamSchema = z.object({
  id: z.string().cuid({ message: '無効なID形式です' }),
})

const customFieldDefinitionSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    postSettingId: z.string(),
    parentId: z.string().nullable(),
    type: customFieldTypeSchema,
    slug: z.string(),
    label: z.string(),
    description: z.string().nullable(),
    isRepeatable: z.boolean(),
    config: z.unknown().nullable(),
    validation: customFieldValidationSchema.nullable(),
    order: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    children: z.array(customFieldDefinitionSchema).optional(),
  })
)

export const postSettingResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: postSettingStatusSchema,
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  definitions: z.array(customFieldDefinitionSchema).optional(),
})

export const postSettingListResponseSchema = z.array(postSettingResponseSchema)

export const customFieldDefinitionResponseSchema = customFieldDefinitionSchema
