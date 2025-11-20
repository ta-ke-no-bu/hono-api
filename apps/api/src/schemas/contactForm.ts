import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

export const contactRecipientTypeSchema = z.enum(['PRIMARY', 'CC', 'BCC'])

export const contactFormRecipientSchema = z.object({
  id: z.string().optional(),
  formId: z.string().optional(),
  email: z.string().email(),
  type: contactRecipientTypeSchema.default('PRIMARY'),
})

export const contactFormBaseSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/i, 'スラッグは半角英数字とハイフンのみ使用できます'),
  description: z.string().optional(),
  successMessage: z.string().optional(),
  autoReplyTemplate: z.string().optional(),
  sendAutoReply: z.boolean().default(true),
  autoReplySubject: z.string().optional(),
  sendAdminNotification: z.boolean().default(true),
  adminNotificationSubject: z.string().optional(),
  adminNotificationTemplate: z.string().optional(),
  notificationEmails: z.string().optional(),
  isActive: z.boolean().default(true),
  replyToFieldSlug: z.string().optional(),
  turnstileEnabled: z.boolean().default(true),
})

export const contactFormCreateSchema = contactFormBaseSchema.extend({
  recipients: z.array(contactFormRecipientSchema).default([]),
})

export const contactFormUpdateSchema = contactFormBaseSchema.partial().extend({
  recipients: z.array(contactFormRecipientSchema).optional(),
})

export const contactFormResponseSchema = contactFormBaseSchema
  .extend({
    id: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    recipients: z.array(
      contactFormRecipientSchema.extend({
        id: z.string(),
        formId: z.string(),
        createdAt: z.string().datetime(),
      })
    ),
  })
  .openapi('ContactFormResponse')

export const contactFieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
})

export const contactFieldDefinitionSchema = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['TEXT', 'TEXTAREA', 'EMAIL', 'TEL', 'SELECT', 'RADIO', 'CHECKBOX', 'NUMBER', 'DATE']),
  required: z.boolean().optional(),
  helpText: z.string().optional(),
  options: z.array(contactFieldOptionSchema).optional(),
  placeholder: z.string().optional(),
  order: z.number().optional(),
})

export type ContactFormRecipientInput = z.infer<typeof contactFormRecipientSchema>
export type ContactFormCreateInput = z.infer<typeof contactFormCreateSchema>
export type ContactFormUpdateInput = z.infer<typeof contactFormUpdateSchema>
export type ContactFieldDefinition = z.infer<typeof contactFieldDefinitionSchema>
