import { describe, expect, it } from 'vitest'
import { ZodError, z } from 'zod'

import { buildCustomFieldsSchema } from '../custom-fields/builder'
import type { CustomFieldDefinition } from '../custom-fields/types'

const baseDefinitions: CustomFieldDefinition[] = [
  {
    type: 'text',
    slug: 'hero-title',
    label: 'ヒーロータイトル',
    validation: {
      required: true,
      maxLength: 50,
    },
  },
  {
    type: 'select',
    slug: 'status',
    label: 'ステータス',
    validation: {
      required: true,
    },
    config: {
      options: [
        { value: 'draft', label: '下書き' },
        { value: 'public', label: '公開' },
      ],
    },
  },
  {
    type: 'repeatable',
    slug: 'cta-list',
    label: 'CTA リスト',
    validation: {
      required: true,
      minItems: 1,
      maxItems: 3,
    },
    itemDefinition: {
      type: 'group',
      slug: 'cta-item',
      label: 'CTA 項目',
      children: [
        {
          type: 'text',
          slug: 'label',
          label: 'ラベル',
          validation: { required: true },
        },
        {
          type: 'text',
          slug: 'url',
          label: 'URL',
          validation: { required: true },
        },
      ],
    },
  },
]

describe('buildCustomFieldsSchema', () => {
  it('指定定義に従い正常な payload を許可する', () => {
    const schema = buildCustomFieldsSchema(baseDefinitions)

    type CustomFieldsPayload = z.infer<typeof schema>

    const payload: CustomFieldsPayload = {
      heroTitle: '  新着情報  ',
      status: { value: 'public', label: '公開' },
      ctaList: [
        {
          label: '資料請求',
          url: 'https://example.com/request',
        },
      ],
    }

    const result = schema.parse(payload)

    expect(result.heroTitle).toBe('新着情報')
    expect(result.status.value).toBe('public')
    expect(result.ctaList).toHaveLength(1)
    expect(result.ctaList[0]).toEqual({ label: '資料請求', url: 'https://example.com/request' })
  })

  it('必須フィールド欠如や選択肢不正を検出する', () => {
    const schema = buildCustomFieldsSchema(baseDefinitions)

    try {
      schema.parse({
        status: { value: 'draft', label: '下書き' },
        ctaList: [],
      })
      expect.fail('必須フィールドの欠如を検出できませんでした')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      const missingTitleIssue = zodError.issues.find((issue) => issue.path.join('.') === 'heroTitle')
      expect(missingTitleIssue?.code).toBe('invalid_type')

      expect(zodError.issues.some((issue) => issue.message.includes('CTA リストは1件以上登録してください。'))).toBe(
        true
      )
    }

    try {
      schema.parse({
        heroTitle: '公開予定',
        status: { value: 'archived', label: '公開停止' },
        ctaList: [
          {
            label: 'お問い合わせ',
            url: 'https://example.com/contact',
          },
        ],
      })
      expect.fail('不正な選択肢値を検出できませんでした')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      expect(zodError.issues.some((issue) => issue.message.includes('ステータスの選択値が不正です。'))).toBe(true)
    }
  })

  it('繰り返しフィールドの件数制約を強制する', () => {
    const schema = buildCustomFieldsSchema(baseDefinitions)

    const payload = {
      heroTitle: 'CTAチェック',
      status: { value: 'public', label: '公開' },
      ctaList: Array.from({ length: 4 }).map((_, index) => ({
        label: `リンク${index + 1}`,
        url: `https://example.com/${index + 1}`,
      })),
    }

    try {
      schema.parse(payload)
      expect.fail('繰り返しフィールドの上限違反を検出できませんでした')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      expect(zodError.issues.some((issue) => issue.message.includes('CTA リストは3件以内で登録してください。'))).toBe(
        true
      )
    }
  })
})
