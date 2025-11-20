import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware } from '../middleware/auth'
import {
  postCreateSchema,
  postIdParamSchema,
  postListQuerySchema,
  postListResponseSchema,
  postPublicListResponseSchema,
  postPublicResponseSchema,
  postResponseSchema,
  postUpdateSchema,
} from '../schemas/post'
import {
  createPost,
  deletePost,
  getPostById,
  getPublicPostById,
  listPosts,
  listPublicPosts,
  updatePost,
} from '../services/post'
import { getPrismaClient } from '../utils/prisma'

const posts = new OpenAPIHono()

posts.use('*', (c, next) => {
  if (c.req.path.startsWith('/app/api/posts/public')) {
    return next()
  }
  return authMiddleware(c, next)
})

const publicListRoute = createRoute({
  method: 'get',
  path: '/public',
  responses: {
    200: {
      description: '公開投稿一覧の取得に成功しました',
      content: {
        'application/json': {
          schema: postPublicListResponseSchema,
        },
      },
    },
  },
})

posts.openapi(publicListRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const postsData = await listPublicPosts(prisma, c)
  return c.json(postsData)
})

const publicDetailRoute = createRoute({
  method: 'get',
  path: '/public/{id}',
  request: {
    params: postIdParamSchema,
  },
  responses: {
    200: {
      description: '公開投稿の取得に成功しました',
      content: {
        'application/json': {
          schema: postPublicResponseSchema,
        },
      },
    },
    404: {
      description: '投稿が見つかりません',
    },
  },
})

posts.openapi(publicDetailRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const post = await getPublicPostById(prisma, c, id)
  if (!post) {
    return c.json({ message: '投稿が見つかりません。' }, 404)
  }
  return c.json(post)
})

const CATEGORY_NONE_VALUE = '__NONE__'

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  request: {
    query: postListQuerySchema,
  },
  responses: {
    200: {
      description: '投稿一覧の取得に成功しました',
      content: {
        'application/json': {
          schema: postListResponseSchema,
        },
      },
    },
  },
})

posts.openapi(listRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { postSettingId, keyword, title, categoryId, status, detailEnabled } = c.req.valid('query')

  const filters: {
    postSettingId?: string
    keyword?: string
    title?: string
    categoryId?: string | null
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
    detailEnabled?: boolean
  } = {}

  if (postSettingId) {
    filters.postSettingId = postSettingId
  }
  if (keyword) {
    filters.keyword = keyword
  }
  if (title) {
    filters.title = title
  }
  if (categoryId !== undefined) {
    filters.categoryId = categoryId === CATEGORY_NONE_VALUE ? null : categoryId
  }
  if (status) {
    filters.status = status
  }
  if (detailEnabled !== undefined) {
    filters.detailEnabled = detailEnabled
  }

  const postsData = await listPosts(prisma, filters)
  return c.json(postsData)
})

const createRouteConfig = createRoute({
  method: 'post',
  path: '/',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: postCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '投稿の作成に成功しました',
      content: {
        'application/json': {
          schema: postResponseSchema,
        },
      },
    },
    400: {
      description: 'リクエストが不正です',
    },
    409: {
      description: 'カテゴリが存在しない、または重複しています',
    },
  },
})

posts.openapi(createRouteConfig, async (c) => {
  const prisma = getPrismaClient(c)
  const payload = c.req.valid('json')

  try {
    const post = await createPost(prisma, c, payload)
    return c.json(post, 201)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('投稿の作成に失敗しました:', error)
    throw new HTTPException(500, { message: '投稿の作成に失敗しました。' })
  }
})

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: postIdParamSchema,
  },
  responses: {
    200: {
      description: '投稿を取得しました',
      content: {
        'application/json': {
          schema: postResponseSchema,
        },
      },
    },
    404: {
      description: '投稿が見つかりません',
    },
  },
})

posts.openapi(getRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const post = await getPostById(prisma, id)

  if (!post) {
    return c.json({ message: '投稿が見つかりません。' }, 404)
  }

  return c.json(post)
})

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: postIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: postUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '投稿を更新しました',
      content: {
        'application/json': {
          schema: postResponseSchema,
        },
      },
    },
    404: {
      description: '投稿が見つかりません',
    },
    409: {
      description: 'カテゴリが存在しない、または重複しています',
    },
  },
})

posts.openapi(updateRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const payload = c.req.valid('json')

  try {
    const post = await updatePost(prisma, c, id, payload)
    return c.json(post)
  } catch (error) {
    console.warn('[api/posts:update] error', {
      id,
      payload,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('投稿の更新に失敗しました:', error)
    throw new HTTPException(500, { message: '投稿の更新に失敗しました。' })
  }
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: postIdParamSchema,
  },
  responses: {
    204: {
      description: '投稿を削除しました',
    },
    404: {
      description: '投稿が見つかりません',
    },
  },
})

posts.openapi(deleteRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')

  try {
    await deletePost(prisma, c, id)
    return c.body(null, 204)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('投稿の削除に失敗しました:', error)
    throw new HTTPException(500, { message: '投稿の削除に失敗しました。' })
  }
})

export default posts
