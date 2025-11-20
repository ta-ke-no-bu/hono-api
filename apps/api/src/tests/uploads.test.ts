import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import app from '../index'
import * as envModule from '../utils/env'
import * as r2Module from '../utils/r2'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const PRISMA_SCHEMA_PATH = path.join(REPO_ROOT, 'apps/api/prisma/schema.prisma')

const TEST_JWT_SECRET = 'test_jwt_secret_value_should_be_very_long_123456'

let prisma: PrismaClient
let token: string
let restoreJwt: string | undefined
let createPresignedUploadMock: vi.SpiedFunction<typeof r2Module.createPresignedUpload>

const sendUploadRequest = async (
  pathSuffix: 'pdf' | 'image',
  payload: { fileName: string; contentType: string; contentLength: number }
) => {
  const request = new Request(`http://localhost/app/api/uploads/${pathSuffix}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  return app.fetch(request, { env: { prisma } })
}

describe('アップロードAPI', () => {
  beforeAll(async () => {
    restoreJwt = process.env.JWT_SECRET
    process.env.JWT_SECRET = TEST_JWT_SECRET

    vi.spyOn(envModule, 'getValidatedEnv').mockReturnValue({
      NODE_ENV: 'test',
      TURNSTILE_SECRET_KEY: 'turnstile-secret',
      RESEND_API_KEY: 'resend-api-key',
      ADMIN_EMAIL: 'admin@example.com',
      FROM_EMAIL: 'from@example.com',
      JWT_SECRET: TEST_JWT_SECRET,
      LOGINS_TURNSTILE_SECRET_KEY: 'login-turnstile-secret',
      LOGINS_TURNSTILE_SITE_KEY: 'login-turnstile-site',
      TURNSTILE_SITE_KEY: 'turnstile-site',
      CLOUDFLARE_ACCOUNT_ID: 'test-account',
      CLOUDFLARE_R2_ACCESS_KEY: 'access',
      CLOUDFLARE_R2_SECRET_KEY: 'secret',
      CLOUDFLARE_R2_BUCKET: 'bucket',
      hono_db: undefined,
    })

    createPresignedUploadMock = vi
      .spyOn(r2Module, 'createPresignedUpload')
      .mockImplementation(async (_ctx, options) => {
        const prefix = (options.objectKeyPrefix ?? 'posts').replace(/\/+$/, '')
        return {
          uploadUrl: 'https://example.com/upload',
          objectUrl: `https://example.com/${prefix}/object`,
          key: `${prefix}/object`,
          expiresIn: 60,
        }
      })

    const prismaDir = path.resolve(process.cwd(), 'apps/api/prisma/test-db')
    const dbPath = path.join(prismaDir, 'dev_uploads.db')

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

    token = await new SignJWT({ userId: 1, email: 'tester@example.com' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(TEST_JWT_SECRET))
  })

  beforeEach(() => {
    createPresignedUploadMock.mockClear()
  })

  afterAll(async () => {
    await prisma.$disconnect()
    vi.restoreAllMocks()
    if (restoreJwt) {
      process.env.JWT_SECRET = restoreJwt
    } else {
      process.env.JWT_SECRET = undefined
    }
  })

  test('POST /app/api/uploads/pdf で署名付きURLを取得できる', async () => {
    const response = await sendUploadRequest('pdf', {
      fileName: 'example.pdf',
      contentType: 'application/pdf',
      contentLength: 1024,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.uploadUrl).toBe('https://example.com/upload')
    expect(body.key).toMatch(/^documents\//)

    const lastCall = createPresignedUploadMock.mock.calls.at(-1)
    expect(lastCall?.[1]).toMatchObject({
      allowedContentTypes: ['application/pdf'],
      maxFileSize: 10 * 1024 * 1024,
      objectKeyPrefix: 'documents',
      fallbackExtension: '.pdf',
    })
  })

  test('PDF以外は拒否される', async () => {
    const response = await sendUploadRequest('pdf', {
      fileName: 'evil.exe',
      contentType: 'application/octet-stream',
      contentLength: 100,
    })

    expect(response.status).toBe(400)
    expect(createPresignedUploadMock).not.toHaveBeenCalled()
  })

  test('POST /app/api/uploads/image で署名付きURLを取得できる', async () => {
    const response = await sendUploadRequest('image', {
      fileName: 'banner.webp',
      contentType: 'image/webp',
      contentLength: 2048,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.key).toMatch(/^images\//)

    const lastCall = createPresignedUploadMock.mock.calls.at(-1)
    expect(lastCall?.[1].objectKeyPrefix).toBe('images')
    expect(lastCall?.[1].maxFileSize).toBe(5 * 1024 * 1024)
    expect(new Set(lastCall?.[1].allowedContentTypes)).toEqual(
      new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
    )
  })

  test('許可されていない画像形式は拒否される', async () => {
    const response = await sendUploadRequest('image', {
      fileName: 'icon.bmp',
      contentType: 'image/bmp',
      contentLength: 2048,
    })

    expect(response.status).toBe(400)
    expect(createPresignedUploadMock).not.toHaveBeenCalled()
  })
})
