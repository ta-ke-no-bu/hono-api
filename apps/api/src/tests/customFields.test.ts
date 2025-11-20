import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import app from '../index'
import * as envModule from '../utils/env'

const TEST_JWT_SECRET = 'test_jwt_secret_value_should_be_very_long_123456'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const PRISMA_SCHEMA_PATH = path.join(REPO_ROOT, 'apps/api/prisma/schema.prisma')

let prisma: PrismaClient
let token: string
let restoreJwt: string | undefined
let restoreDatabaseUrl: string | undefined

const mockEnv = {
  NODE_ENV: 'test',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  RESEND_API_KEY: 'resend-api-key',
  ADMIN_EMAIL: 'admin@example.com',
  FROM_EMAIL: 'from@example.com',
  JWT_SECRET: TEST_JWT_SECRET,
  LOGINS_TURNSTILE_SECRET_KEY: 'login-turnstile-secret',
  LOGINS_TURNSTILE_SITE_KEY: 'login-turnstile-site',
  TURNSTILE_SITE_KEY: 'turnstile-site',
  RESEND_WEBHOOK_SECRET: 'test_resend_webhook_secret_value_should_be_long_123456',
  CRON_JOB_SECRET: 'test_cron_secret',
  hono_db: undefined,
}

const authorizedRequest = (url: string, init: RequestInit = {}) =>
  new Request(`http://localhost${url}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  })

describe('投稿設定 API', () => {
  beforeAll(async () => {
    restoreJwt = process.env.JWT_SECRET
    restoreDatabaseUrl = process.env.DATABASE_URL
    process.env.JWT_SECRET = TEST_JWT_SECRET

    vi.spyOn(envModule, 'getValidatedEnv').mockReturnValue(mockEnv)

    const prismaDir = path.join(REPO_ROOT, 'apps/api/prisma')
    const dbPath = path.join(prismaDir, 'dev_post_settings.db')

    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
    fs.writeFileSync(dbPath, '')

    process.env.DATABASE_URL = `file:${dbPath}`

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

    token = await new SignJWT({ userId: 1, email: 'tester@example.com' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(TEST_JWT_SECRET))
  })

  beforeEach(async () => {
    await prisma.customFieldDefinition.deleteMany()
    await prisma.postSetting.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
    vi.restoreAllMocks()
    if (restoreJwt) {
      process.env.JWT_SECRET = restoreJwt
    } else {
      process.env.JWT_SECRET = undefined
    }
    if (restoreDatabaseUrl) {
      process.env.DATABASE_URL = restoreDatabaseUrl
    } else {
      process.env.DATABASE_URL = undefined
    }
  })

  test('投稿設定を作成し一覧取得できる', async () => {
    const createResponse = await app.fetch(
      authorizedRequest('/app/api/post-settings', {
        method: 'POST',
        body: JSON.stringify({
          name: '投稿用設定',
          slug: 'post-settings-sample',
          description: '投稿に紐付くカスタムフィールド',
        }),
      }),
      { env: { prisma } }
    )

    expect(createResponse.status).toBe(201)
    const created = await createResponse.json()
    expect(created.slug).toBe('post-settings-sample')

    const listResponse = await app.fetch(authorizedRequest('/app/api/post-settings'), { env: { prisma } })
    expect(listResponse.status).toBe(200)
    const list = await listResponse.json()
    expect(Array.isArray(list)).toBe(true)
    expect(list).toHaveLength(1)
    expect(Array.isArray(list[0]?.definitions)).toBe(true)
  })

  test('投稿設定作成時にフィールド定義を同時登録できる', async () => {
    const createResponse = await app.fetch(
      authorizedRequest('/app/api/post-settings', {
        method: 'POST',
        body: JSON.stringify({
          name: '即時登録',
          slug: 'instant-setting',
          definitions: [
            {
              type: 'group',
              slug: 'hero-block',
              label: 'ヒーローブロック',
              children: [
                {
                  type: 'text',
                  slug: 'headline',
                  label: '見出し',
                  validation: { required: true },
                },
              ],
            },
          ],
        }),
      }),
      { env: { prisma } }
    )

    expect(createResponse.status).toBe(201)
    const created = await createResponse.json()
    expect(Array.isArray(created.definitions)).toBe(true)
    expect(created.definitions).toHaveLength(1)
    expect(created.definitions[0]?.children).toHaveLength(1)
    expect(created.definitions[0]?.children?.[0]?.slug).toBe('headline')

    const detailRes = await app.fetch(authorizedRequest(`/app/api/post-settings/${created.id}`), {
      env: { prisma },
    })
    expect(detailRes.status).toBe(200)
    const detail = await detailRes.json()
    expect(detail.definitions).toHaveLength(1)
    expect(detail.definitions[0]?.children).toHaveLength(1)
    expect(detail.definitions[0]?.children?.[0]?.slug).toBe('headline')
  })

  test('フィールド定義を登録してツリーで取得できる', async () => {
    const settingRes = await app.fetch(
      authorizedRequest('/app/api/post-settings', {
        method: 'POST',
        body: JSON.stringify({ name: '投稿', slug: 'post', description: '投稿向け' }),
      }),
      { env: { prisma } }
    )
    expect(settingRes.status).toBe(201)
    const setting = await settingRes.json()

    const rootDefinitionRes = await app.fetch(
      authorizedRequest(`/app/api/post-settings/${setting.id}/definitions`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'group',
          slug: 'hero-block',
          label: 'ヒーローブロック',
        }),
      }),
      { env: { prisma } }
    )
    expect(rootDefinitionRes.status).toBe(201)
    const rootDefinition = await rootDefinitionRes.json()

    const childRes = await app.fetch(
      authorizedRequest(`/app/api/post-settings/${setting.id}/definitions`, {
        method: 'POST',
        body: JSON.stringify({
          parentId: rootDefinition.id,
          type: 'text',
          slug: 'headline',
          label: '見出し',
          validation: { required: true },
        }),
      }),
      { env: { prisma } }
    )
    expect(childRes.status).toBe(201)

    const detailRes = await app.fetch(authorizedRequest(`/app/api/post-settings/${setting.id}`), {
      env: { prisma },
    })
    expect(detailRes.status).toBe(200)
    const detailed = await detailRes.json()
    expect(detailed.definitions).toHaveLength(1)
    expect(detailed.definitions[0]?.children).toHaveLength(1)
    expect(detailed.definitions[0]?.children[0]?.slug).toBe('headline')
  })

  test('select フィールドは1件以上の選択肢が必須', async () => {
    const settingRes = await app.fetch(
      authorizedRequest('/app/api/post-settings', {
        method: 'POST',
        body: JSON.stringify({ name: '警告', slug: 'warning' }),
      }),
      { env: { prisma } }
    )
    expect(settingRes.status).toBe(201)
    const setting = await settingRes.json()

    const response = await app.fetch(
      authorizedRequest(`/app/api/post-settings/${setting.id}/definitions`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'select',
          slug: 'invalid-select',
          label: '不正な選択肢',
          config: {
            options: [],
          },
        }),
      }),
      { env: { prisma } }
    )
    expect(response.status).toBe(400)
    const body = await response.text()
    expect(body).toMatch(/選択肢を1件以上指定してください/)
  })
})
