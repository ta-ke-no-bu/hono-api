import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { type Prisma, PrismaClient } from '@prisma/client'
import type { Context } from 'hono'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createPost,
  deletePost,
  getPostById,
  getPublicPostById,
  listPosts,
  listPublicPosts,
  updatePost,
} from '../services/post'
import { deleteCustomFieldDefinition, updateCustomFieldDefinition } from '../services/postSetting'
import { decrypt } from '../utils/crypto'
import * as envModule from '../utils/env'
import * as r2Module from '../utils/r2'

const TEST_JWT_SECRET = 'test_jwt_secret_value_should_be_very_long_123456'
const TEST_AUDIT_SECRET = 'test_audit_secret_value_should_be_long_123456'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const PRISMA_SCHEMA_PATH = path.join(REPO_ROOT, 'apps/api/prisma/schema.prisma')

let prisma: PrismaClient
let userId: number
let categoryId: string
let restoreJwt: string | undefined
let defaultPostSetting: { id: string; name: string }
const mockEnv = {
  NODE_ENV: 'test',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  RESEND_API_KEY: 'resend-api-key',
  ADMIN_EMAIL: 'admin@example.com',
  FROM_EMAIL: 'from@example.com',
  JWT_SECRET: TEST_JWT_SECRET,
  AUDIT_LOG_ENCRYPTION_KEY: TEST_AUDIT_SECRET,
  LOGINS_TURNSTILE_SECRET_KEY: 'login-turnstile-secret',
  LOGINS_TURNSTILE_SITE_KEY: 'login-turnstile-site',
  TURNSTILE_SITE_KEY: 'turnstile-site',
  RESEND_WEBHOOK_SECRET: 'test_resend_webhook_secret_value_should_be_long_123456',
  CRON_JOB_SECRET: 'test_cron_secret',
  hono_db: undefined,
}

let deleteSpy: ReturnType<typeof vi.spyOn>

type PostCustomFields = {
  headline?: string
  ctaList?: Array<{
    label?: string
    url?: string
    appearance?: string
  }>
} & Record<string, unknown>

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null))

const createMockContext = (overrides?: { userId?: number; email?: string }) => {
  const store = new Map<string, unknown>()
  store.set('validatedEnv', mockEnv)
  if (overrides?.userId) {
    store.set('user', { userId: overrides.userId, email: overrides.email ?? 'tester@example.com' })
  }
  const headers = new Map<string, string>()
  headers.set('cf-connecting-ip', '127.0.0.1')
  headers.set('user-agent', 'vitest')

  const ctx = {
    req: {
      header: (name: string) => headers.get(name.toLowerCase()) ?? undefined,
      ip: '127.0.0.1',
    },
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => {
      store.set(key, value)
      return value
    },
  }

  return ctx as unknown as Context
}

const createSamplePostSetting = async () => {
  const slug = `test-setting-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const setting = await prisma.postSetting.create({
    data: {
      name: 'テスト投稿設定',
      slug,
      status: 'ACTIVE',
    },
  })

  await prisma.customFieldDefinition.create({
    data: {
      postSettingId: setting.id,
      type: 'text',
      slug: 'headline',
      label: '見出し',
      order: 0,
      validation: JSON.stringify({ required: true, maxLength: 40 }),
    },
  })

  const repeatable = await prisma.customFieldDefinition.create({
    data: {
      postSettingId: setting.id,
      type: 'group',
      slug: 'cta-list',
      label: 'CTA リスト',
      order: 1,
      validation: JSON.stringify({ minItems: 1, maxItems: 3 }),
      isRepeatable: true,
    },
  })

  const group = await prisma.customFieldDefinition.create({
    data: {
      postSettingId: setting.id,
      parentId: repeatable.id,
      type: 'group',
      slug: 'cta-item',
      label: 'CTA 項目',
      order: 0,
      isRepeatable: false,
    },
  })

  await prisma.customFieldDefinition.create({
    data: {
      postSettingId: setting.id,
      parentId: group.id,
      type: 'text',
      slug: 'label',
      label: 'ボタンラベル',
      order: 0,
      validation: JSON.stringify({ required: true }),
    },
  })

  await prisma.customFieldDefinition.create({
    data: {
      postSettingId: setting.id,
      parentId: group.id,
      type: 'text',
      slug: 'url',
      label: 'リンクURL',
      order: 1,
      validation: JSON.stringify({ required: true }),
    },
  })

  await prisma.customFieldDefinition.create({
    data: {
      postSettingId: setting.id,
      parentId: group.id,
      type: 'select',
      slug: 'appearance',
      label: '表示スタイル',
      order: 2,
      config: JSON.stringify({
        options: [
          { value: 'primary', label: 'プライマリ' },
          { value: 'secondary', label: 'セカンダリ' },
        ],
      }),
    },
  })

  return { id: setting.id, name: setting.name }
}

const createDefaultPostSetting = async () => {
  const setting = await prisma.postSetting.create({
    data: {
      name: 'デフォルト投稿設定',
      slug: 'post-default',
      status: 'ACTIVE',
    },
  })

  return { id: setting.id, name: setting.name }
}

beforeAll(async () => {
  restoreJwt = process.env.JWT_SECRET
  process.env.JWT_SECRET = TEST_JWT_SECRET

  vi.spyOn(envModule, 'getValidatedEnv').mockReturnValue(mockEnv)
  deleteSpy = vi.spyOn(r2Module, 'deleteObjectFromR2').mockResolvedValue()

  const prismaDir = path.join(REPO_ROOT, 'apps/api/prisma/test-db')
  const dbPath = path.join(prismaDir, 'dev_posts.db')

  if (!fs.existsSync(prismaDir)) {
    fs.mkdirSync(prismaDir, { recursive: true })
  }

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
  }
  fs.writeFileSync(dbPath, '')

  prisma = new PrismaClient({
    datasources: {
      db: { url: pathToFileURL(dbPath).href },
    },
  })

  await prisma.$connect()

  execSync(`bunx prisma db push --accept-data-loss --skip-generate --schema ${PRISMA_SCHEMA_PATH}`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
  })

  await prisma.$disconnect()
  await prisma.$connect()
})

beforeEach(async () => {
  deleteSpy.mockClear()
  await prisma.post.deleteMany()
  await prisma.customFieldDefinition.deleteMany()
  await prisma.postSetting.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.category.deleteMany()
  await prisma.user.deleteMany()

  const user = await prisma.user.create({
    data: {
      email: 'tester@example.com',
      password: 'hashed-password',
      name: 'tester',
    },
  })

  userId = user.id

  const category = await prisma.category.create({
    data: {
      name: 'ニュース',
    },
  })

  categoryId = category.id

  defaultPostSetting = await createDefaultPostSetting()
})

afterAll(async () => {
  await prisma.$disconnect()
  deleteSpy.mockRestore()
  if (restoreJwt) {
    process.env.JWT_SECRET = restoreJwt
  } else {
    process.env.JWT_SECRET = undefined
  }
})

describe('投稿サービス', () => {
  test('createPost で詳細投稿を作成するとHTMLがサニタイズされる', async () => {
    const context = createMockContext({ userId })
    const created = await createPost(prisma, context, {
      title: ' 初回投稿 ',
      categoryId,
      postSettingId: defaultPostSetting.id,
      publishedAt: '2025-10-01T09:00:00.000Z',
      detailBody: '<p>安全な本文<span onclick="alert(1)">テスト</span><script>alert(0)</script></p>',
    })

    expect(created.title).toBe('初回投稿')
    expect(created.categoryId).toBe(categoryId)
    expect(created.detailBody).toContain('安全な本文')
    expect(created.detailBody).not.toContain('script')
    expect(created.detailBody).not.toContain('onclick')
    expect(created.detailEnabled).toBe(false)
    expect(created.postSettingId).toBe(defaultPostSetting.id)
    expect(created.postSettingName).toBe(defaultPostSetting.name)
    expect(created.customFields).toBeNull()

    const stored = await prisma.post.findUnique({ where: { id: created.id } })
    expect(stored?.detailBody).not.toContain('script')
  })

  test('createPost で文字色のspanが保持される', async () => {
    const context = createMockContext({ userId })
    const coloredHtml = '<p><span data-color="#E60000" style="color: rgb(230, 0, 0);">色付きテキスト</span></p>'

    const created = await createPost(prisma, context, {
      title: 'カラー付き投稿',
      categoryId,
      postSettingId: defaultPostSetting.id,
      publishedAt: '2025-10-02T09:00:00.000Z',
      detailBody: coloredHtml,
    })

    expect(created.detailBody).toMatch(/data-color="#E60000"/)
    expect(created.detailBody).toMatch(/style="[^"]*color:\s*(#?E60000|rgb\(230,\s*0,\s*0\))/i)

    const persisted = await prisma.post.findUnique({ where: { id: created.id } })
    expect(persisted?.detailBody).toBeTruthy()
    expect(persisted?.detailBody).toMatch(/data-color="#E60000"/)
    expect(persisted?.detailBody).toMatch(/style="[^"]*color:\s*(#?E60000|rgb\(230,\s*0,\s*0\))/i)

    await prisma.post.update({
      where: { id: created.id },
      data: {
        detailBody: '<p><span #E60000 color: rgb(230, 0, 0);>色付きテキスト</span></p>',
      },
    })

    const normalized = await getPostById(prisma, created.id)
    expect(normalized?.detailBody).toMatch(/data-color="#E60000"/)
    expect(normalized?.detailBody).toMatch(/style="[^"]*color:\s*(#?E60000|rgb\(230,\s*0,\s*0\))/i)
  })

  test('createPost で詳細ページ生成を有効化できる', async () => {
    const context = createMockContext({ userId })
    const created = await createPost(prisma, context, {
      title: '詳細ページあり',
      categoryId,
      postSettingId: defaultPostSetting.id,
      publishedAt: '2025-10-04T00:00:00.000Z',
      detailBody: '<p>本文</p>',
      detailEnabled: true,
      detailSlug: 'detail-page',
    })

    expect(created.detailEnabled).toBe(true)
    expect(created.detailSlug).toBe('detail-page')
    expect(created.detailBody).toContain('本文')
    expect(created.postSettingId).toBe(defaultPostSetting.id)
    expect(created.postSettingName).toBe(defaultPostSetting.name)
    expect(created.customFields).toBeNull()
  })

  test('createPost で不正な文字を含む detail slug はエラーになる', async () => {
    const context = createMockContext({ userId })

    await expect(
      createPost(prisma, context, {
        title: '不正slug',
        categoryId,
        postSettingId: defaultPostSetting.id,
        publishedAt: '2025-10-05T00:00:00.000Z',
        detailBody: '<p>本文</p>',
        detailEnabled: true,
        detailSlug: 'invalid slug',
      })
    ).rejects.toMatchObject({
      status: 400,
      message: '詳細ページのslugは半角英数字とハイフンのみ利用できます。',
    })
  })

  test('createPost で3文字未満の detail slug はエラーになる', async () => {
    const context = createMockContext({ userId })

    await expect(
      createPost(prisma, context, {
        title: '短いslug',
        categoryId,
        postSettingId: defaultPostSetting.id,
        publishedAt: '2025-10-05T00:00:00.000Z',
        detailBody: '<p>本文</p>',
        detailEnabled: true,
        detailSlug: 'ab',
      })
    ).rejects.toMatchObject({
      status: 400,
      message: '詳細ページのslugは3文字以上120文字以内で入力してください。',
    })
  })

  test('createPost で渡した detail slug はトリムされて保存される', async () => {
    const context = createMockContext({ userId })
    const created = await createPost(prisma, context, {
      title: 'トリムslug',
      categoryId,
      postSettingId: defaultPostSetting.id,
      publishedAt: '2025-10-05T00:00:00.000Z',
      detailBody: '<p>本文</p>',
      detailEnabled: true,
      detailSlug: '  news-article-001  ',
    })

    expect(created.detailEnabled).toBe(true)
    expect(created.detailSlug).toBe('news-article-001')

    const stored = await prisma.post.findUnique({ where: { id: created.id } })
    expect(stored?.detailSlug).toBe('news-article-001')
  })

  test('updatePost でタイトルと公開日を更新できる', async () => {
    const context = createMockContext({ userId })
    const initial = await createPost(prisma, context, {
      title: '初期タイトル',
      categoryId,
      postSettingId: defaultPostSetting.id,
      publishedAt: '2025-09-01T00:00:00.000Z',
    })

    const nextCategory = await prisma.category.create({ data: { name: 'リリース' } })

    const updated = await updatePost(prisma, context, initial.id, {
      title: '更新後タイトル',
      categoryId: nextCategory.id,
      publishedAt: '2025-10-15T00:00:00.000Z',
      detailBody: '<h2>詳細</h2><p>本文</p>',
    })

    expect(updated.title).toBe('更新後タイトル')
    expect(updated.categoryId).toBe(nextCategory.id)
    expect(updated.detailBody).toContain('詳細')
  })

  test('updatePost で詳細ページ生成フラグを更新できる', async () => {
    const context = createMockContext({ userId })
    const created = await createPost(prisma, context, {
      title: '詳細ページ設定',
      categoryId,
      postSettingId: defaultPostSetting.id,
      publishedAt: '2025-10-05T00:00:00.000Z',
      detailBody: '<p>詳細本文</p>',
    })

    const updated = await updatePost(prisma, context, created.id, {
      detailEnabled: true,
      detailSlug: 'detail-page',
    })

    expect(updated.detailEnabled).toBe(true)
    expect(updated.detailSlug).toBe('detail-page')
  })

  test('updatePost でカスタムフィールドを更新できる', async () => {
    const context = createMockContext({ userId })
    const { id: setId, name: setName } = await createSamplePostSetting()

    const created = await createPost(prisma, context, {
      title: 'カスタム投稿',
      categoryId,
      publishedAt: '2025-10-08T00:00:00.000Z',
      detailBody: '<p>本文</p>',
      postSettingId: setId,
      customFields: JSON.stringify({
        headline: '初期見出し',
        ctaList: [
          {
            label: '資料ダウンロード',
            url: 'https://example.com/docs',
            appearance: 'primary',
          },
        ],
      }),
    })

    expect(created.postSettingName).toBe(setName)

    const updated = await updatePost(prisma, context, created.id, {
      customFields: JSON.stringify({
        headline: '更新後の見出し',
        ctaList: [
          {
            label: 'お問い合わせ',
            url: 'https://example.com/contact',
            appearance: 'secondary',
          },
        ],
      }),
    })

    const customFields = JSON.parse(updated.customFields ?? '{}') as PostCustomFields
    expect(customFields.headline).toBe('更新後の見出し')
    const firstCta = customFields.ctaList?.[0]
    expect(firstCta?.appearance).toBe('secondary')
  })

  test('createPost でカスタムフィールドを保存できる', async () => {
    const context = createMockContext({ userId })
    const { id: setId, name: setName } = await createSamplePostSetting()

    const created = await createPost(prisma, context, {
      title: 'カスタム投稿',
      categoryId,
      publishedAt: '2025-10-06T00:00:00.000Z',
      detailBody: '<p>本文</p>',
      postSettingId: setId,
      customFields: JSON.stringify({
        headline: '  新着情報 ',
        ctaList: [
          {
            label: '資料請求',
            url: 'https://example.com/request',
            appearance: 'primary',
          },
        ],
      }),
    })

    expect(created.postSettingId).toBe(setId)
    expect(created.postSettingName).toBe(setName)
    const customFields = JSON.parse(created.customFields ?? '{}') as PostCustomFields
    expect(customFields.headline).toBe('新着情報')
    expect(Array.isArray(customFields.ctaList)).toBe(true)
    expect(customFields.ctaList?.[0]?.url).toBe('https://example.com/request')
    expect(customFields.ctaList?.[0]?.appearance).toBe('primary')

    const stored = await prisma.post.findUnique({ where: { id: created.id } })
    expect(stored?.postSettingId).toBe(setId)
    expect(stored?.customFields).not.toBeNull()
  })

  test('listPosts は投稿設定の名前を含む', async () => {
    const context = createMockContext({ userId })
    await createPost(prisma, context, {
      title: '古い記事',
      categoryId,
      postSettingId: defaultPostSetting.id,
      publishedAt: '2025-09-01T00:00:00.000Z',
      detailBody: '<p>Old</p>',
    })

    const posts = await listPosts(prisma)
    expect(posts[0]?.postSettingId).toBe(defaultPostSetting.id)
    expect(posts[0]?.postSettingName).toBe(defaultPostSetting.name)
    expect(posts[0]?.customFields).toBeNull()
  })

  test('listPosts はキーワードでタイトルとカスタムフィールドを横断検索できる', async () => {
    const context = createMockContext({ userId })
    const { id: settingId } = await createSamplePostSetting()

    await createPost(prisma, context, {
      title: '夏の特集記事',
      categoryId,
      postSettingId: settingId,
      publishedAt: '2025-07-01T00:00:00.000Z',
      customFields: JSON.stringify({
        headline: '夏祭りイベント速報',
        ctaList: [
          {
            label: '参加申し込み',
            url: 'https://example.com/summer',
            appearance: 'primary',
          },
        ],
      }),
    })

    await createPost(prisma, context, {
      title: '冬の定期メンテナンス',
      categoryId,
      postSettingId: settingId,
      publishedAt: '2025-12-15T00:00:00.000Z',
      customFields: JSON.stringify({
        headline: 'メンテナンスのお知らせ',
        ctaList: [
          {
            label: '詳細はこちら',
            url: 'https://example.com/winter',
            appearance: 'secondary',
          },
        ],
      }),
    })

    const eventMatches = await listPosts(prisma, { keyword: 'イベント' })
    expect(eventMatches).toHaveLength(1)
    expect(eventMatches[0]?.title).toBe('夏の特集記事')

    const titleMatches = await listPosts(prisma, { keyword: 'メンテナンス' })
    expect(titleMatches.some((post) => post.title === '冬の定期メンテナンス')).toBe(true)
    expect(titleMatches.every((post) => post.title !== '夏の特集記事')).toBe(true)
  })

  test('deletePost で投稿を削除できる', async () => {
    const context = createMockContext({ userId })
    const target = await createPost(prisma, context, {
      title: '削除対象',
      categoryId,
      postSettingId: defaultPostSetting.id,
      publishedAt: '2025-09-20T00:00:00.000Z',
    })

    await deletePost(prisma, context, target.id)
    const exists = await prisma.post.findUnique({ where: { id: target.id } })
    expect(exists).toBeNull()
  })

  test('createPost で postSettingId を省略するとデフォルト設定が使われる', async () => {
    const context = createMockContext({ userId })
    const created = await createPost(prisma, context, {
      title: 'デフォルト設定投稿',
      categoryId,
      publishedAt: '2025-10-21T00:00:00.000Z',
      usedFallback: true, // このフラグはスキーマのtransformで付与される
      postSettingId: 'post-default', // スキーマのtransformで設定される値
    })

    expect(created.postSettingId).toBe(defaultPostSetting.id)
    expect(created.postSettingName).toBe(defaultPostSetting.name)
    expect(created.customFields).toBeNull()

    const auditLog = await prisma.auditLog.findFirst({
      where: { eventType: 'POST_CREATED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(auditLog).not.toBeNull()
    const rawDetails = auditLog?.details ?? null
    expect(rawDetails).not.toBeNull()
    const decrypted = rawDetails ? decrypt(rawDetails, mockEnv.AUDIT_LOG_ENCRYPTION_KEY) : '{}'
    const details = JSON.parse(decrypted)
    expect(details.usedFallback).toBe(true)
  })

  test('createPost でデフォルト設定が無効な場合は409エラー', async () => {
    await prisma.postSetting.update({
      where: { slug: 'post-default' },
      data: { status: 'INACTIVE' },
    })

    const context = createMockContext({ userId })

    await expect(
      createPost(prisma, context, {
        title: '無効なデフォルト設定',
        categoryId,
        publishedAt: '2025-10-21T00:00:00.000Z',
        usedFallback: true,
        postSettingId: 'post-default',
      })
    ).rejects.toMatchObject({
      status: 409,
      message: '既定の投稿設定が無効です。システム管理者に連絡してください。',
    })
  })
})
