import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

export const contactSubmissionValuesSchema = z.record(z.string(), z.unknown())

export const contactSubmissionRequestSchema = z.object({
  formSlug: z.string().min(1),
  values: contactSubmissionValuesSchema,
  turnstileToken: z.string().min(1, 'Turnstileトークンは必須です'),
})

export type ContactSubmissionInput = z.infer<typeof contactSubmissionRequestSchema>

export const contactSubmissionResponseSchema = z
  .object({
    success: z.boolean().openapi({ description: '操作成功かどうか' }),
    message: z.string().openapi({ description: 'レスポンスメッセージ' }),
    contactId: z.string().openapi({ description: '登録された問い合わせID' }),
    successMessage: z.string().nullable().optional(),
  })
  .openapi({
    type: 'object',
    title: 'ContactSubmissionResponse',
    description: 'お問い合わせフォームのレスポンスデータ',
  })

export const contactSubmissionSummarySchema = z
  .object({
    id: z.string().uuid(),
    formId: z.string(),
    formName: z.string(),
    formSlug: z.string(),
    displayName: z.string().nullable(),
    displayEmail: z.string().nullable(),
    displaySubject: z.string().nullable(),
    emailStatus: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('ContactSubmissionSummary')

export const contactListMetaSchema = z
  .object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalCount: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  })
  .openapi('ContactListMeta')

export const contactSubmissionListSchema = z
  .object({
    data: z.array(contactSubmissionSummarySchema),
    meta: contactListMetaSchema,
  })
  .openapi('ContactSubmissionList')

export const contactSubmissionDetailSchema = contactSubmissionSummarySchema
  .extend({
    payload: z.record(z.string(), z.unknown()),
    form: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    }),
  })
  .openapi('ContactSubmissionDetail')

export type ContactSubmissionSummary = z.infer<typeof contactSubmissionSummarySchema>
export type ContactSubmissionDetail = z.infer<typeof contactSubmissionDetailSchema>
