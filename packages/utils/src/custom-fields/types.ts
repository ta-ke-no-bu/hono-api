export const CUSTOM_FIELD_TYPES = [
  'text',
  'richText',
  'date',
  'file',
  'select',
  'checkbox',
  'group',
  'repeatable',
] as const

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

export interface CustomFieldValidation {
  required?: boolean
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
}

export interface SelectOption {
  label: string
  value: string
}

export interface FileConfig {
  accept?: string[]
  maxSize?: number
  storagePath?: string
}

export interface TextConfig {
  multiline?: boolean
}

export interface RichTextConfig {
  toolbarPreset?: string
  placeholder?: string
}

export interface DateConfig {
  mode?: 'date' | 'dateTime'
}

export interface CheckboxConfig {
  maxSelections?: number
}

export interface CustomFieldDefinitionBase {
  id?: string
  slug: string
  label: string
  description?: string
  validation?: CustomFieldValidation
}

export interface TextFieldDefinition extends CustomFieldDefinitionBase {
  type: 'text'
  config?: TextConfig
}

export interface RichTextFieldDefinition extends CustomFieldDefinitionBase {
  type: 'richText'
  config?: RichTextConfig
}

export interface DateFieldDefinition extends CustomFieldDefinitionBase {
  type: 'date'
  config?: DateConfig
}

export interface FileFieldDefinition extends CustomFieldDefinitionBase {
  type: 'file'
  config?: FileConfig
}

export interface SelectFieldDefinition extends CustomFieldDefinitionBase {
  type: 'select'
  config?: {
    options: SelectOption[]
    allowCustom?: boolean
  }
}

export interface CheckboxFieldDefinition extends CustomFieldDefinitionBase {
  type: 'checkbox'
  config?: {
    options: SelectOption[]
  } & CheckboxConfig
}

export interface GroupFieldDefinition extends CustomFieldDefinitionBase {
  type: 'group'
  children: CustomFieldDefinition[]
}

export interface RepeatableFieldDefinition extends CustomFieldDefinitionBase {
  type: 'repeatable'
  itemDefinition: CustomFieldDefinition
  validation?: CustomFieldValidation & { minItems?: number; maxItems?: number }
}

export type CustomFieldDefinition =
  | TextFieldDefinition
  | RichTextFieldDefinition
  | DateFieldDefinition
  | FileFieldDefinition
  | SelectFieldDefinition
  | CheckboxFieldDefinition
  | GroupFieldDefinition
  | RepeatableFieldDefinition

export interface SchemaBuildContext {
  slugToKey?: (slug: string) => string
  context?: 'admin' | 'public' | (string & {})
}
