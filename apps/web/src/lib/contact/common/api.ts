import { getApiBaseUrl } from '@lib/utils/api'
import type { ContactFieldDefinition, ContactFormDefinition } from './definitions'

export type ContactFormMetadata = ContactFormDefinition

export type ContactSubmissionPayload = {
  formSlug: string
  values: Record<string, unknown>
  turnstileToken: string
}

export const fetchContactFormMetadata = async (slug: string): Promise<ContactFormMetadata> => {
  const response = await fetch(`${getApiBaseUrl()}/contact/forms/public/${slug}`)
  if (!response.ok) {
    throw new Error(`フォーム情報の取得に失敗しました (${response.status})`)
  }
  return (await response.json()) as ContactFormMetadata
}

export const submitContactForm = async (payload: ContactSubmissionPayload) => {
  const response = await fetch(`${getApiBaseUrl()}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => ({ message: 'Unexpected error' }))

  if (!response.ok) {
    const message = result?.message ?? `送信に失敗しました (${response.status})`
    throw new Error(message)
  }

  return result as { successMessage?: string | null; message?: string | null }
}

const coerceSingleValue = (value: FormDataEntryValue | null): string | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined
  }
  return String(value)
}

export const buildSubmissionValues = (
  fields: ContactFieldDefinition[],
  formData: FormData
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const field of fields) {
    switch (field.type) {
      case 'CHECKBOX': {
        const values = formData.getAll(field.slug).map((item) => String(item))
        if (values.length > 0) {
          result[field.slug] = values
        }
        break
      }
      case 'RADIO':
      case 'SELECT':
      case 'EMAIL':
      case 'TEL':
      case 'TEXT':
      case 'TEXTAREA':
      case 'DATE': {
        const value = coerceSingleValue(formData.get(field.slug))
        if (value !== undefined) {
          result[field.slug] = value
        }
        break
      }
      case 'NUMBER': {
        const raw = coerceSingleValue(formData.get(field.slug))
        if (raw !== undefined) {
          const parsed = Number(raw)
          if (!Number.isNaN(parsed)) {
            result[field.slug] = parsed
          }
        }
        break
      }
      default: {
        const value = coerceSingleValue(formData.get(field.slug))
        if (value !== undefined) {
          result[field.slug] = value
        }
      }
    }
  }

  return result
}
