import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { DEFAULT_POST_SETTING, migratePosts } from '../../scripts/migrate-legacy-posts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const PRISMA_SCHEMA_PATH = path.join(REPO_ROOT, 'apps/api/prisma/schema.prisma')

let prisma: PrismaClient

beforeAll(async () => {
  const prismaDir = path.join(REPO_ROOT, 'apps/api/prisma/test-db')
  const dbPath = path.join(prismaDir, 'legacy_migration.db')

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
  await prisma.post.deleteMany()
  await prisma.customFieldDefinition.deleteMany()
  await prisma.postSetting.deleteMany()
  await prisma.category.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migratePosts', () => {
  test('assigns default template and normalizes slugs', async () => {
    await prisma.$executeRaw`DROP INDEX IF EXISTS "Post_detailSlug_key"`

    const legacySetting = await prisma.postSetting.create({
      data: {
        name: 'レガシー設定',
        slug: 'legacy-setting',
        status: 'INACTIVE',
      },
    })

    const posts = await prisma.$transaction(
      ['Invalid Slug!!', '', 'dup-slug', 'dup-slug', 'should-clear'].map((slug, index) =>
        prisma.post.create({
          data: {
            title: index === 1 ? 'Hello World' : `Post ${index + 1}`,
            postSettingId: legacySetting.id,
            detailEnabled: index !== 4,
            detailSlug: slug,
            publishedAt: new Date(`2025-01-0${index + 1}T00:00:00.000Z`),
          },
        })
      )
    )

    await migratePosts(prisma)

    const defaultSetting = await prisma.postSetting.findUniqueOrThrow({
      where: { slug: DEFAULT_POST_SETTING.slug },
    })

    const migrated = await prisma.post.findMany({ orderBy: { createdAt: 'asc' } })

    expect(migrated).toHaveLength(posts.length)
    migrated.forEach((post) => {
      expect(post.postSettingId).toBe(defaultSetting.id)
    })

    const slugs = migrated.map((post) => post.detailSlug)
    expect(slugs).toEqual(['invalid-slug', 'hello-world', 'dup-slug', 'dup-slug-1', null])

    await prisma.$executeRaw`CREATE UNIQUE INDEX "Post_detailSlug_key" ON "Post"("detailSlug")`
  })

  test('is idempotent when executed multiple times', async () => {
    const defaultSetting = await prisma.postSetting.create({
      data: {
        name: '既定設定',
        slug: DEFAULT_POST_SETTING.slug,
        status: 'ACTIVE',
      },
    })

    const initial = await prisma.post.create({
      data: {
        title: 'Initial',
        postSettingId: defaultSetting.id,
        detailEnabled: true,
        detailSlug: 'initial',
      },
    })

    await migratePosts(prisma)

    const firstRun = await prisma.post.findUniqueOrThrow({ where: { id: initial.id } })

    await migratePosts(prisma)
    const secondRun = await prisma.post.findUniqueOrThrow({ where: { id: initial.id } })

    expect(secondRun.postSettingId).toBe(firstRun.postSettingId)
    expect(secondRun.detailSlug).toBe(firstRun.detailSlug)
  })
})
