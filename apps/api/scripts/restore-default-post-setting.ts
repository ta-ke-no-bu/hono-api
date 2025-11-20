import { PrismaClient, Prisma } from '@prisma/client'

type JsonValue = Prisma.InputJsonValue

interface DefinitionSeed {
  slug: string
  type: Prisma.CustomFieldType
  label: string
  description?: string
  order: number
  validation?: JsonValue
  config?: JsonValue
  isRepeatable?: boolean
  children?: DefinitionSeed[]
}

const prisma = new PrismaClient()

const DEFAULT_POST_SETTING = {
  id: 'post-default-setting',
  slug: 'post-default',
  name: '標準投稿設定',
  description: '投稿画面でカスタムフィールド機能を試すためのサンプル定義',
} as const

const DEFAULT_CUSTOM_FIELD_DEFINITIONS: DefinitionSeed[] = [
  {
    slug: 'hero-title',
    type: 'text',
    label: 'ヒーロータイトル',
    description: 'トップセクションに表示する見出し',
    order: 0,
    validation: {
      required: true,
      maxLength: 60,
    },
  },
  {
    slug: 'hero-description',
    type: 'richText',
    label: 'ヒーロー本文',
    order: 1,
    validation: {
      maxLength: 2000,
    },
    config: {
      toolbarPreset: 'basic',
      placeholder: '本文を入力してください',
    },
  },
  {
    slug: 'feature-window',
    type: 'group',
    label: '掲載期間',
    order: 2,
    children: [
      {
        slug: 'start',
        type: 'date',
        label: '開始日時',
        order: 0,
        config: {
          mode: 'dateTime',
        },
      },
      {
        slug: 'end',
        type: 'date',
        label: '終了日時',
        order: 1,
        config: {
          mode: 'dateTime',
        },
      },
    ],
  },
  {
    slug: 'cta-list',
    type: 'group',
    label: 'CTA リンク',
    description: 'CTA ボタンを複数登録できます',
    order: 3,
    validation: {
      minItems: 0,
      maxItems: 5,
    },
    isRepeatable: true,
    children: [
      {
        slug: 'cta-item',
        type: 'group',
        label: 'CTA 項目',
        order: 0,
        children: [
          {
            slug: 'label',
            type: 'text',
            label: 'ボタンラベル',
            order: 0,
            validation: {
              required: true,
              maxLength: 40,
            },
          },
          {
            slug: 'url',
            type: 'text',
            label: 'リンクURL',
            order: 1,
            validation: {
              required: true,
            },
          },
          {
            slug: 'appearance',
            type: 'select',
            label: '表示スタイル',
            order: 2,
            config: {
              options: [
                { value: 'primary', label: 'プライマリ' },
                { value: 'secondary', label: 'セカンダリ' },
                { value: 'link', label: 'テキストリンク' },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'resource-file',
    type: 'file',
    label: '関連資料',
    description: 'ダウンロード用資料を添付します',
    order: 4,
    config: {
      accept: ['application/pdf', 'image/png', 'image/jpeg'],
      maxSize: 5 * 1024 * 1024,
      storagePath: 'posts/resources',
    },
  },
  {
    slug: 'channels',
    type: 'checkbox',
    label: '掲載チャネル',
    order: 5,
    validation: {
      required: true,
      minItems: 1,
      maxItems: 3,
    },
    config: {
      options: [
        { value: 'website', label: 'Webサイト' },
        { value: 'app', label: 'アプリ' },
        { value: 'email', label: 'メール' },
        { value: 'social', label: 'SNS' },
      ],
      maxSelections: 3,
    },
  },
  {
    slug: 'cta-behavior',
    type: 'select',
    label: 'CTA 表示条件',
    order: 6,
    config: {
      options: [
        { value: 'always', label: '常に表示' },
        { value: 'logged-in', label: 'ログインユーザーのみ' },
        { value: 'hidden', label: '非表示' },
      ],
      allowCustom: false,
    },
  },
  {
    slug: 'internal-note',
    type: 'text',
    label: '内部メモ',
    description: '公開されない備忘録',
    order: 7,
    config: {
      multiline: true,
    },
    validation: {
      maxLength: 500,
    },
  },
]

const toNullableString = (value?: JsonValue): string | null =>
  value === undefined ? null : JSON.stringify(value)

const syncDefinitionTree = async (
  tx: Prisma.TransactionClient,
  postSettingId: string,
  seeds: DefinitionSeed[],
  parentId: string | null = null
): Promise<void> => {
  const existing = await tx.customFieldDefinition.findMany({
    where: {
      postSettingId,
      parentId: parentId === null ? null : parentId,
    },
  })

  const existingSlugs = new Set(existing.map((definition) => definition.slug))
  const seedSlugs = new Set(seeds.map((definition) => definition.slug))

  const removableSlugs = [...existingSlugs].filter((slug) => !seedSlugs.has(slug))
  if (removableSlugs.length > 0) {
    await tx.customFieldDefinition.deleteMany({
      where: {
        postSettingId,
        parentId: parentId === null ? null : parentId,
        slug: { in: removableSlugs },
      },
    })
  }

  for (const seed of seeds) {
    const record = await tx.customFieldDefinition.upsert({
      where: {
        postSettingId_slug: {
          postSettingId,
          slug: seed.slug,
        },
      },
      create: {
        postSettingId,
        parentId,
        type: seed.type,
      slug: seed.slug,
      label: seed.label,
      description: seed.description ?? null,
      order: seed.order,
      validation: toNullableString(seed.validation),
      config: toNullableString(seed.config),
      isRepeatable: Boolean(seed.isRepeatable),
    },
    update: {
      parentId,
      type: seed.type,
      label: seed.label,
      description: seed.description ?? null,
      order: seed.order,
      validation: toNullableString(seed.validation),
      config: toNullableString(seed.config),
      isRepeatable: Boolean(seed.isRepeatable),
      },
    })

    await syncDefinitionTree(tx, postSettingId, seed.children ?? [], record.id)
  }
}

async function restoreDefaultPostSetting() {
  await prisma.$transaction(async (tx) => {
    const setting = await tx.postSetting.upsert({
      where: { slug: DEFAULT_POST_SETTING.slug },
      update: {
        name: DEFAULT_POST_SETTING.name,
        description: DEFAULT_POST_SETTING.description,
        status: 'ACTIVE',
      },
      create: {
        id: DEFAULT_POST_SETTING.id,
        slug: DEFAULT_POST_SETTING.slug,
        name: DEFAULT_POST_SETTING.name,
        description: DEFAULT_POST_SETTING.description,
        status: 'ACTIVE',
      },
    })

    await syncDefinitionTree(tx, setting.id, DEFAULT_CUSTOM_FIELD_DEFINITIONS)
  })

  console.log('✅ 既定テンプレート(post-default)を復旧しました。')
}

async function main() {
  try {
    await restoreDefaultPostSetting()
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('post-default の復旧に失敗しました。', error)
  process.exit(1)
})
