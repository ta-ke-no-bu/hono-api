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
  slug: string
  successMessage?: string
  fields: ContactFieldDefinition[]
}

export const CONTACT_FORM_DEFINITIONS: Record<string, ContactFormDefinition> = {
  inquiry: {
    slug: 'inquiry',
    successMessage: 'お問い合わせありがとうございました。',
    fields: [
      {
        slug: 'attribute',
        label: 'あなたの属性を教えてください',
        type: 'RADIO',
        required: true,
        order: 1,
        options: [
          { value: 'general', label: '一般の方' },
          { value: 'ophthalmologist', label: '眼科医' },
          { value: 'optician', label: '眼鏡店' },
          { value: 'company', label: '企業' },
          { value: 'other', label: 'その他' },
        ],
      },
      {
        slug: 'purposes',
        label: 'このサイトを知ったきっかけ、または目的を教えてください',
        type: 'SELECT',
        required: true,
        order: 2,
        options: [
          { value: 'optician_intro', label: '眼鏡店の紹介' },
          { value: 'ophthalmologist_intro', label: '眼科医の紹介' },
          { value: 'vision_consult', label: '視力の悩み相談' },
          { value: 'talent_introduction', label: '人材を紹介' },
          { value: 'company_intro', label: '企業の紹介' },
          { value: 'management_consult', label: '経営の相談' },
          { value: 'other', label: 'その他' },
        ],
      },
      { slug: 'other_purpose', label: 'その他の方は詳細をご記入ください', type: 'TEXT', order: 3 },
      { slug: 'name', label: 'お名前', type: 'TEXT', required: true, order: 4 },
      {
        slug: 'organization',
        label: '組織名（法人、自治体、施設・店舗名など）',
        type: 'TEXT',
        required: true,
        order: 5,
      },
      { slug: 'email', label: 'メールアドレス', type: 'EMAIL', required: true, order: 6 },
      { slug: 'email_confirm', label: 'メールアドレス（確認）', type: 'EMAIL', required: true, order: 7 },
      {
        slug: 'phone',
        label: '電話番号（日中連絡のつく携帯電話など）',
        type: 'TEL',
        required: true,
        order: 8,
      },
      { slug: 'message', label: 'お問い合わせ', type: 'TEXTAREA', required: true, order: 9 },
    ],
  },
  recruit: {
    slug: 'recruit',
    successMessage: '採用お問い合わせを受け付けました。',
    fields: [
      { slug: 'name', label: '氏名', type: 'TEXT', required: true },
      { slug: 'email', label: 'メールアドレス', type: 'EMAIL', required: true },
      { slug: 'phone', label: '電話番号', type: 'TEL' },
      {
        slug: 'position',
        label: '希望職種',
        type: 'SELECT',
        required: true,
        options: [
          { value: 'frontend', label: 'フロントエンドエンジニア' },
          { value: 'backend', label: 'バックエンドエンジニア' },
          { value: 'designer', label: 'デザイナー' },
          { value: 'other', label: 'その他' },
        ],
      },
      {
        slug: 'career',
        label: '経歴・スキル概要',
        type: 'TEXTAREA',
        required: true,
        helpText: '300文字以内でご経歴や得意分野をご記入ください。',
      },
      {
        slug: 'portfolio',
        label: 'ポートフォリオURL',
        type: 'TEXT',
        placeholder: 'https://example.com',
      },
    ],
  },
}

export const getContactFormDefinition = (slug: string) => CONTACT_FORM_DEFINITIONS[slug]

const buildOptionLabelMap = () => {
  const map: Record<string, Record<string, Record<string, string>>> = {}

  for (const [formSlug, definition] of Object.entries(CONTACT_FORM_DEFINITIONS)) {
    const fieldMap: Record<string, Record<string, string>> = {}

    for (const field of definition.fields) {
      if (!field.options || field.options.length === 0) {
        continue
      }

      fieldMap[field.slug] = field.options.reduce<Record<string, string>>((acc, option) => {
        acc[option.value] = option.label
        return acc
      }, {})
    }

    if (Object.keys(fieldMap).length > 0) {
      map[formSlug] = fieldMap
    }
  }

  return map
}

export const CONTACT_OPTION_LABELS = buildOptionLabelMap()

export const resolveOptionLabel = (formSlug: string, fieldSlug: string, value: string): string | null => {
  const formMap = CONTACT_OPTION_LABELS[formSlug]
  if (!formMap) {
    return null
  }

  const fieldMap = formMap[fieldSlug]
  if (!fieldMap) {
    return null
  }

  return fieldMap[value] ?? null
}

export const resolveOptionLabels = (formSlug: string, fieldSlug: string, values: string[]): string[] => {
  return values.map((value) => resolveOptionLabel(formSlug, fieldSlug, value) ?? value)
}
