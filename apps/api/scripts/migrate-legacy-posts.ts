import { PrismaClient } from '@prisma/client'

export const DEFAULT_POST_SETTING = {
  slug: 'post-default',
  name: '既存投稿（自動移行）',
  description: 'テンプレート移行スクリプトにより作成された既定の投稿設定です。',
} as const

export const MIN_SLUG_LENGTH = 3
export const MAX_SLUG_LENGTH = 120

export async function ensureDefaultPostSetting(prisma: PrismaClient) {
  const existing = await prisma.postSetting.findUnique({ where: { slug: DEFAULT_POST_SETTING.slug } })
  if (existing) {
    return existing
  }

  return prisma.postSetting.create({
    data: {
      name: DEFAULT_POST_SETTING.name,
      slug: DEFAULT_POST_SETTING.slug,
      description: DEFAULT_POST_SETTING.description,
      status: 'ACTIVE',
    },
  })
}

export function normalizeSlug(raw: string): string {
  if (!raw) {
    return ''
  }
  const normalized = raw
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{ASCII}]+/gu, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized.slice(0, MAX_SLUG_LENGTH)
}

export function ensureMinLength(slug: string, fallbackId: string): string {
  const sanitized = normalizeSlug(slug)
  if (sanitized.length >= MIN_SLUG_LENGTH) {
    return sanitized
  }
  const padded = `${sanitized}-${fallbackId.slice(0, MIN_SLUG_LENGTH)}`
  const normalizedPadded = normalizeSlug(padded)
  if (normalizedPadded.length >= MIN_SLUG_LENGTH) {
    return normalizedPadded
  }
  return normalizeSlug(`post-${fallbackId.slice(0, 8)}`)
}

export function generateSlugFromTitle(title: string, fallbackId: string): string {
  const base = normalizeSlug(title)
  if (base.length >= MIN_SLUG_LENGTH) {
    return base
  }
  return ensureMinLength(base, fallbackId)
}

export function makeUniqueSlug(baseSlug: string, used: Set<string>, postId: string): string {
  const base = ensureMinLength(baseSlug, postId)
  let candidate = base
  let counter = 1

  while (used.has(candidate)) {
    const suffix = `-${counter}`
    const maxBaseLength = MAX_SLUG_LENGTH - suffix.length
    const trimmedBase = base.slice(0, Math.max(maxBaseLength, MIN_SLUG_LENGTH))
    candidate = ensureMinLength(`${trimmedBase}${suffix}`, postId)
    counter += 1
  }

  used.add(candidate)
  return candidate
}

export async function migratePosts(prisma: PrismaClient) {
  const defaultSetting = await ensureDefaultPostSetting(prisma)

  const posts = await prisma.post.findMany({
    select: {
      id: true,
      title: true,
      postSettingId: true,
      detailEnabled: true,
      detailSlug: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (posts.length === 0) {
    console.log('投稿データが存在しないため処理を終了しました。')
    return
  }

  const usedSlugs = new Set<string>()

  let updatedPosts = 0
  let assignedDefaultSetting = 0
  let generatedSlugs = 0
  let normalizedSlugs = 0
  let clearedSlugs = 0

  for (const post of posts) {
    const updates: { postSettingId?: string; detailSlug?: string | null } = {}

    if (post.postSettingId !== defaultSetting.id) {
      updates.postSettingId = defaultSetting.id
      assignedDefaultSetting += 1
    }

    if (post.detailEnabled) {
      const existingSlug = post.detailSlug ?? ''
      const normalized = normalizeSlug(existingSlug)

      let baseSlug = normalized
      if (!existingSlug || normalized !== existingSlug) {
        if (!existingSlug) {
          baseSlug = generateSlugFromTitle(post.title, post.id)
          generatedSlugs += 1
        } else if (normalized) {
          baseSlug = normalized
          normalizedSlugs += 1
        } else {
          baseSlug = generateSlugFromTitle(post.title, post.id)
          generatedSlugs += 1
        }
      }

      const finalSlug = makeUniqueSlug(baseSlug, usedSlugs, post.id)

      if (finalSlug !== post.detailSlug) {
        updates.detailSlug = finalSlug
      }

      usedSlugs.add(finalSlug)
    } else if (post.detailSlug) {
      updates.detailSlug = null
      clearedSlugs += 1
    }

    if (Object.keys(updates).length > 0) {
      await prisma.post.update({ where: { id: post.id }, data: updates })
      updatedPosts += 1
    }
  }

  console.log('投稿テンプレート移行が完了しました。', {
    totalPosts: posts.length,
    updatedPosts,
    assignedDefaultSetting,
    generatedSlugs,
    normalizedSlugs,
    clearedSlugs,
  })
}

async function main() {
  const prisma = new PrismaClient()
  try {
    await migratePosts(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('移行スクリプトの実行中にエラーが発生しました。', error)
  process.exit(1)
})
