
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type JsonValue = Prisma.InputJsonValue

interface DefinitionSeed {
  slug: string
  type: Prisma.CustomFieldType
  label: string
  description?: string
  order: number
  isRepeatable?: boolean
  validation?: JsonValue
  config?: JsonValue
  children?: DefinitionSeed[]
}

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
    isRepeatable: true,
    label: 'CTA リンク',
    description: 'CTA ボタンを複数登録できます',
    order: 3,
    validation: {
      minItems: 0,
      maxItems: 5,
    },
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

const serializeJsonOrNull = (value?: JsonValue): string | null => {
  if (value === undefined) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value)
}

const syncDefinitionTree = async (
  postSettingId: string,
  seeds: DefinitionSeed[],
  parentId: string | null = null
): Promise<void> => {
  const existing = await prisma.customFieldDefinition.findMany({
    where: {
      postSettingId,
      parentId: parentId === null ? null : parentId,
    },
  })

  const existingSlugs = new Set(existing.map((definition) => definition.slug))
  const seedSlugs = new Set(seeds.map((definition) => definition.slug))

  const removableSlugs = [...existingSlugs].filter((slug) => !seedSlugs.has(slug))
  if (removableSlugs.length > 0) {
    await prisma.customFieldDefinition.deleteMany({
      where: {
        postSettingId,
        parentId: parentId === null ? null : parentId,
        slug: { in: removableSlugs },
      },
    })
  }

  for (const seed of seeds) {
    const record = await prisma.customFieldDefinition.upsert({
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
        isRepeatable: seed.isRepeatable ?? false,
        slug: seed.slug,
        label: seed.label,
        description: seed.description ?? null,
        order: seed.order,
        validation: serializeJsonOrNull(seed.validation),
        config: serializeJsonOrNull(seed.config),
      },
      update: {
        parentId,
        type: seed.type,
        isRepeatable: seed.isRepeatable ?? false,
        label: seed.label,
        description: seed.description ?? null,
        order: seed.order,
        validation: serializeJsonOrNull(seed.validation),
        config: serializeJsonOrNull(seed.config),
      },
    })

    await syncDefinitionTree(postSettingId, seed.children ?? [], record.id)
  }
}

const seedPostSetting = async () => {
  const setting = await prisma.postSetting.upsert({
    where: { slug: DEFAULT_POST_SETTING.slug },
    update: {
      name: DEFAULT_POST_SETTING.name,
      description: DEFAULT_POST_SETTING.description,
    },
    create: {
      id: DEFAULT_POST_SETTING.id,
      slug: DEFAULT_POST_SETTING.slug,
      name: DEFAULT_POST_SETTING.name,
      description: DEFAULT_POST_SETTING.description,
    },
  })

  await syncDefinitionTree(setting.id, DEFAULT_CUSTOM_FIELD_DEFINITIONS)

  const count = await prisma.customFieldDefinition.count({ where: { postSettingId: setting.id } })
  console.log(`投稿設定を同期しました: ${setting.name} (定義数: ${count})`)
}

async function main() {
  const email = 'admin@example.com';
  const password = 'password123'; // 開発用の簡単なパスワード

  console.log(`Seeding database with user: ${email}`);

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: email },
    update: {},
    create: {
      email: email,
      name: 'Admin User',
      password: hashedPassword,
    },
  });

  console.log(`Upserted user: ${user.email}`);

  console.log('メール送信設定は管理画面から登録してください');

  const defaultForm = await prisma.contactForm.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      id: 'default-form',
      name: 'デフォルトお問い合わせフォーム',
      slug: 'default',
      isActive: true,
      replyToFieldSlug: 'email',
    },
  })

  console.log(`デフォルトフォーム: ${defaultForm.name} (${defaultForm.slug})`)

  const inquiryForm = await prisma.contactForm.upsert({
    where: { slug: 'inquiry' },
    update: {},
    create: {
      id: 'inquiry-form',
      name: 'お問い合わせフォーム',
      slug: 'inquiry',
      isActive: true,
      replyToFieldSlug: 'email',
    },
  })

  console.log(`お問い合わせフォーム: ${inquiryForm.name} (${inquiryForm.slug})`)

  await prisma.post.deleteMany()
  console.log('既存の投稿を削除しました（開発用）')

  await seedPostSetting()
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
