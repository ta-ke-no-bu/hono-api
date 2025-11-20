import { z } from 'zod'

import { ensureKeyLength, slugToCamelCase } from './helpers'
import type {
  CheckboxFieldDefinition,
  CustomFieldDefinition,
  RepeatableFieldDefinition,
  SchemaBuildContext,
  SelectFieldDefinition,
} from './types'

type AnyZod = z.ZodTypeAny

const assertNever = (value: never): never => {
  const type = (value as { type?: string }).type ?? 'unknown'
  throw new Error(`未対応のフィールドタイプです: ${type}`)
}

const optionalize = <T extends AnyZod>(schema: T, required: boolean, ctx: SchemaBuildContext): AnyZod => {
  const isAdminContext = ctx.context === 'admin'

  if (isAdminContext) {
    return schema.nullable().optional()
  }

  if (required) {
    return schema
  }
  return schema.nullable().optional()
}

const applyLengthConstraint = (schema: z.ZodString, definition: CustomFieldDefinition) => {
  const { validation, label } = definition
  let working = schema
  if (validation?.minLength) {
    working = working.min(validation.minLength, `${label}は${validation.minLength}文字以上で入力してください。`)
  }
  if (validation?.maxLength) {
    working = working.max(validation.maxLength, `${label}は${validation.maxLength}文字以内で入力してください。`)
  }
  return working
}

const buildTextSchema = (definition: CustomFieldDefinition, required: boolean, ctx: SchemaBuildContext): AnyZod => {
  const schema = applyLengthConstraint(z.string().trim(), definition)
  return optionalize(schema, required, ctx)
}

const buildRichTextSchema = (
  definition: CustomFieldDefinition,
  required: boolean,
  ctx: SchemaBuildContext
): AnyZod => {
  const objectSchema = z
    .object({
      html: z.string().min(1, `${definition.label}のHTMLが空です。`).max(20000),
      json: z.any(),
    })
    .strict()
  return optionalize(objectSchema, required, ctx)
}

const buildDateSchema = (definition: CustomFieldDefinition, required: boolean, ctx: SchemaBuildContext): AnyZod => {
  let schema = z.string().datetime({ message: `${definition.label}はISO8601形式で指定してください。` })
  schema = schema.refine(
    (value) => value.endsWith('Z'),
    `${definition.label}はUTCタイムゾーン（Z）で指定してください。`
  )
  return optionalize(schema, required, ctx)
}

const buildFileSchema = (definition: CustomFieldDefinition, required: boolean, ctx: SchemaBuildContext): AnyZod => {
  const base = z
    .object({
      key: z.string().min(1, `${definition.label}のファイルキーが不正です。`),
      url: z.string().url(`${definition.label}のURL形式が不正です。`),
      filename: z.string().min(1).optional(),
      size: z.number().int().nonnegative().optional(),
      contentType: z.string().optional(),
      alt: z.string().max(160).optional(),
    })
    .strict()
  return optionalize(base, required, ctx)
}

const buildSelectSchema = (definition: SelectFieldDefinition, required: boolean, ctx: SchemaBuildContext): AnyZod => {
  const optionValues = definition.config?.options?.map((opt) => opt.value) ?? []
  let schema = z.string()
  if (optionValues.length) {
    schema = schema.refine((value) => optionValues.includes(value), `${definition.label}の選択値が不正です。`)
  }
  return optionalize(schema, required, ctx)
}

const buildCheckboxSchema = (
  definition: CheckboxFieldDefinition,
  required: boolean,
  ctx: SchemaBuildContext
): AnyZod => {
  const optionValues = definition.config?.options?.map((opt) => opt.value) ?? []
  let schema = z.array(
    z
      .object({
        value: optionValues.length
          ? z.string().refine((value) => optionValues.includes(value), `${definition.label}の選択値が不正です。`)
          : z.string(),
        label: z.string().min(1),
      })
      .strict()
  )

  const { validation, config, label } = definition
  const minItems = validation?.minItems ?? (validation?.required ? 1 : undefined)
  const maxItems = validation?.maxItems ?? config?.maxSelections

  if (minItems) {
    schema = schema.min(minItems, `${label}は${minItems}件以上選択してください。`)
  }
  if (maxItems) {
    schema = schema.max(maxItems, `${label}は${maxItems}件以内で選択してください。`)
  }

  return optionalize(schema, required, ctx)
}

const buildGroupSchema = (definition: CustomFieldDefinition, ctx: SchemaBuildContext, required: boolean): AnyZod => {
  if (!('children' in definition)) {
    throw new Error('グループフィールドにchildrenが定義されていません。')
  }
  const shape = buildShape(definition.children, ctx)
  const groupSchema = z.object(shape).strict()
  return optionalize(groupSchema, required, ctx)
}

const buildRepeatableSchema = (
  definition: RepeatableFieldDefinition,
  ctx: SchemaBuildContext,
  required: boolean
): AnyZod => {
  const itemSchema = buildFieldSchema(definition.itemDefinition, ctx, true)
  let arraySchema = z.array(itemSchema)
  const { validation, label } = definition

  const minItems = validation?.minItems ?? (validation?.required ? 1 : undefined)
  if (minItems) {
    arraySchema = arraySchema.min(minItems, `${label}は${minItems}件以上登録してください。`)
  }

  if (validation?.maxItems) {
    arraySchema = arraySchema.max(validation.maxItems, `${label}は${validation.maxItems}件以内で登録してください。`)
  }

  return optionalize(arraySchema, required, ctx)
}

const buildFieldSchema = (
  definition: CustomFieldDefinition,
  ctx: SchemaBuildContext,
  forceRequired = false
): AnyZod => {
  const required = forceRequired || !!definition.validation?.required
  switch (definition.type) {
    case 'text':
      return buildTextSchema(definition, required, ctx)
    case 'richText':
      return buildRichTextSchema(definition, required, ctx)
    case 'date':
      return buildDateSchema(definition, required, ctx)
    case 'file':
      return buildFileSchema(definition, required, ctx)
    case 'select':
      return buildSelectSchema(definition, required, ctx)
    case 'checkbox':
      return buildCheckboxSchema(definition, required, ctx)
    case 'group':
      return buildGroupSchema(definition, ctx, required)
    case 'repeatable':
      return buildRepeatableSchema(definition, ctx, required)
    default:
      return assertNever(definition)
  }
}

const buildShape = (definitions: CustomFieldDefinition[], ctx: SchemaBuildContext): Record<string, AnyZod> => {
  const slugResolver = ctx.slugToKey ?? slugToCamelCase
  return definitions.reduce<Record<string, AnyZod>>((shape, definition) => {
    const key = ensureKeyLength(slugResolver(definition.slug))
    shape[key] = buildFieldSchema(definition, ctx)
    return shape
  }, {})
}

export const buildCustomFieldsSchema = (
  definitions: CustomFieldDefinition[],
  ctx: SchemaBuildContext = {}
): z.ZodObject<Record<string, AnyZod>> => {
  if (!definitions.length) {
    return z.object({}).strict()
  }

  const shape = buildShape(definitions, ctx)
  return z.object(shape).strict()
}

export type CustomFieldsSchema = ReturnType<typeof buildCustomFieldsSchema>
