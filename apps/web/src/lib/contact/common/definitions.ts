export type ContactFieldOption = {
  value: string
  label: string
}

export type ContactFieldDefinition = {
  slug: string
  label: string
  type: 'TEXT' | 'TEXTAREA' | 'EMAIL' | 'TEL' | 'SELECT' | 'RADIO' | 'CHECKBOX' | 'NUMBER' | 'DATE'
  required?: boolean
  helpText?: string
  options?: ContactFieldOption[]
  placeholder?: string
  order?: number
}

export type ContactFormDefinition = {
  id: string
  name: string
  slug: string
  description: string | null
  successMessage: string | null
  replyToFieldSlug: string | null
  turnstileEnabled: boolean
  fields: ContactFieldDefinition[]
}

export type ContactOptionLabelMap = Record<string, Record<string, string>>

export const buildOptionLabelMap = (fields: ContactFieldDefinition[]): ContactOptionLabelMap => {
  return fields.reduce<Record<string, Record<string, string>>>((acc, field) => {
    if (!field.options || field.options.length === 0) {
      return acc
    }
    acc[field.slug] = field.options.reduce<Record<string, string>>((map, option) => {
      map[option.value] = option.label
      return map
    }, {})
    return acc
  }, {})
}
