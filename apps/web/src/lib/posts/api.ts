import { getApiBaseUrl } from '@lib/utils/api'

const apiBase = getApiBaseUrl()

export type CustomFieldDefinition = {
  id: string
  type: 'text' | 'richText' | 'date' | 'file' | 'select' | 'checkbox' | 'group' | 'repeatable'
  slug: string
  label: string
  description?: string | null
  config?: Record<string, unknown> | null
  validation?: Record<string, unknown> | null
  children?: CustomFieldDefinition[]
}

export type CustomFieldSet = {
  id: string
  name: string
  slug: string
  definitions: CustomFieldDefinition[]
}

export type PublicPost = {
  id: string
  postSettingId: string
  postSettingName: string | null
  postSettingSlug: string | null
  title: string
  categoryId: string | null
  categoryName: string | null
  detailEnabled: boolean
  detailSlug: string | null
  detailBody: string | null
  publishedAt: string | null
  postedAt: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  customFields: Record<string, unknown> | null
  customFieldSet: CustomFieldSet | null
  createdAt: string
  updatedAt: string
}

type ApiPublicPost = {
  id: string
  postSettingId: string
  postSettingName: string | null
  postSettingSlug: string | null
  title: string
  categoryId: string | null
  categoryName: string | null
  detailEnabled: boolean
  detailSlug: string | null
  detailBody: string | null
  publishedAt: string | null
  postedAt: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  customFields: unknown
  customFieldSet: CustomFieldSet | null
  createdAt: string
  updatedAt: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseCustomFields = (raw: unknown): Record<string, unknown> | null => {
  if (!raw) {
    return null
  }
  if (isRecord(raw)) {
    return raw
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

const normalizePublicPost = (post: ApiPublicPost): PublicPost => {
  const normalizedSlug = typeof post.detailSlug === 'string' ? post.detailSlug.trim() : ''

  return {
    ...post,
    detailSlug: normalizedSlug.length > 0 ? normalizedSlug : null,
    customFields: parseCustomFields(post.customFields),
  }
}

export const fetchPublicPosts = async (): Promise<PublicPost[]> => {
  try {
    const response = await fetch(`${apiBase}/posts/public`, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (!response.ok) {
      console.error(`投稿一覧の取得に失敗しました (status: ${response.status})`)
      return []
    }
    const posts = (await response.json()) as ApiPublicPost[]
    return posts.map((post) => normalizePublicPost(post))
  } catch (error) {
    console.error('投稿一覧の取得中にエラーが発生しました', error)
    return []
  }
}

export type PublicCategory = {
  id: string
  name: string
  slug: string
}

export const fetchPublicCategories = async (): Promise<PublicCategory[]> => {
  try {
    const response = await fetch(`${apiBase}/categories/public`, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (!response.ok) {
      console.error(`カテゴリ一覧の取得に失敗しました (status: ${response.status})`)
      return []
    }
    const categories = (await response.json()) as PublicCategory[]
    return categories
  } catch (error) {
    console.error('カテゴリ一覧の取得中にエラーが発生しました', error)
    return []
  }
}

export const fetchPublicPostById = async (id: string): Promise<PublicPost | null> => {
  try {
    const response = await fetch(`${apiBase}/posts/public/${encodeURIComponent(id)}`, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (!response.ok) {
      console.error(`投稿の取得に失敗しました (status: ${response.status})`)
      return null
    }
    const post = (await response.json()) as ApiPublicPost
    return normalizePublicPost(post)
  } catch (error) {
    console.error('投稿詳細の取得中にエラーが発生しました', error)
    return null
  }
}
