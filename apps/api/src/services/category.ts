import type { Category, PrismaClient } from '@prisma/client'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createAuditLog } from '../utils/auditLog'

const formatCategory = (category: Category) => ({
  id: category.id,
  name: category.name,
  slug: category.slug ?? null,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
})

const sanitizeName = (name: string) => name.trim()

const normalizeSlug = (slug: string | null | undefined) => {
  if (slug === null || slug === undefined || slug.trim() === '') {
    return null
  }
  return slug.trim().toLowerCase()
}

export const listCategories = async (prisma: PrismaClient) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  })
  return categories.map(formatCategory)
}

export const getCategoryById = async (prisma: PrismaClient, id: string) => {
  const category = await prisma.category.findUnique({ where: { id } })
  return category ? formatCategory(category) : null
}

export const createCategory = async (
  prisma: PrismaClient,
  c: Context,
  input: { name: string; slug?: string | null }
) => {
  const sanitizedName = sanitizeName(input.name)
  const normalizedSlug = normalizeSlug(input.slug ?? null)

  try {
    const category = await prisma.category.create({
      data: { name: sanitizedName, slug: normalizedSlug },
    })

    await createAuditLog(prisma, c, 'CATEGORY_CREATED', c.get('user')?.userId, {
      categoryId: category.id,
      name: category.name,
      slug: category.slug,
    })

    return formatCategory(category)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new HTTPException(409, { message: 'カテゴリ名またはスラッグが重複しています。' })
    }
    throw error
  }
}

export const updateCategory = async (
  prisma: PrismaClient,
  c: Context,
  id: string,
  input: { name?: string; slug?: string | null }
) => {
  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) {
    throw new HTTPException(404, { message: 'カテゴリが見つかりません。' })
  }

  const data: { name?: string; slug?: string | null } = {}
  if (typeof input.name === 'string') {
    data.name = sanitizeName(input.name)
  }

  if (input.slug !== undefined) {
    data.slug = normalizeSlug(input.slug)
  }

  try {
    const updated = await prisma.category.update({ where: { id }, data })

    await createAuditLog(prisma, c, 'CATEGORY_UPDATED', c.get('user')?.userId, {
      categoryId: updated.id,
      changes: {
        nameChanged: data.name !== undefined && data.name !== existing.name,
        slugChanged: data.slug !== undefined && data.slug !== existing.slug,
      },
    })

    return formatCategory(updated)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new HTTPException(409, { message: 'カテゴリ名またはスラッグが重複しています。' })
    }
    throw error
  }
}

export const deleteCategory = async (prisma: PrismaClient, c: Context, id: string) => {
  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) {
    throw new HTTPException(404, { message: 'カテゴリが見つかりません。' })
  }

  const postCount = await prisma.post.count({ where: { categoryId: id } })
  if (postCount > 0) {
    throw new HTTPException(409, { message: 'このカテゴリに紐づく投稿が存在するため削除できません。' })
  }

  await prisma.category.delete({ where: { id } })

  await createAuditLog(prisma, c, 'CATEGORY_DELETED', c.get('user')?.userId, {
    categoryId: id,
    name: existing.name,
    slug: existing.slug,
  })
}
