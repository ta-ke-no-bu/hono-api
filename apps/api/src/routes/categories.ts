import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware } from '../middleware/auth'
import {
  categoryCreateSchema,
  categoryIdParamSchema,
  categoryListResponseSchema,
  categoryResponseSchema,
  categoryUpdateSchema,
} from '../schemas/category'
import { createCategory, deleteCategory, getCategoryById, listCategories, updateCategory } from '../services/category'
import { getPrismaClient } from '../utils/prisma'

const categories = new OpenAPIHono()

categories.use('*', (c, next) => {
  if (c.req.path.startsWith('/app/api/categories/public')) {
    return next()
  }
  return authMiddleware(c, next)
})

const publicListRoute = createRoute({
  method: 'get',
  path: '/public',
  responses: {
    200: {
      description: '公開カテゴリ一覧の取得に成功しました',
      content: {
        'application/json': {
          schema: categoryListResponseSchema,
        },
      },
    },
  },
})

categories.openapi(publicListRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const results = await listCategories(prisma)
  return c.json(results)
})

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'カテゴリ一覧の取得に成功しました',
      content: {
        'application/json': {
          schema: categoryListResponseSchema,
        },
      },
    },
  },
})

categories.openapi(listRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const results = await listCategories(prisma)
  return c.json(results)
})

const createRouteConfig = createRoute({
  method: 'post',
  path: '/',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: categoryCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'カテゴリの作成に成功しました',
      content: {
        'application/json': {
          schema: categoryResponseSchema,
        },
      },
    },
    409: {
      description: 'カテゴリが重複しています',
    },
  },
})

categories.openapi(createRouteConfig, async (c) => {
  const prisma = getPrismaClient(c)
  const payload = c.req.valid('json')
  try {
    const category = await createCategory(prisma, c, payload)
    return c.json(category, 201)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('カテゴリの作成に失敗しました:', error)
    throw new HTTPException(500, { message: 'カテゴリの作成に失敗しました。' })
  }
})

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: categoryIdParamSchema,
  },
  responses: {
    200: {
      description: 'カテゴリを取得しました',
      content: {
        'application/json': {
          schema: categoryResponseSchema,
        },
      },
    },
    404: {
      description: 'カテゴリが見つかりません',
    },
  },
})

categories.openapi(getRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const category = await getCategoryById(prisma, id)
  if (!category) {
    return c.json({ message: 'カテゴリが見つかりません。' }, 404)
  }
  return c.json(category)
})

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: categoryIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: categoryUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'カテゴリを更新しました',
      content: {
        'application/json': {
          schema: categoryResponseSchema,
        },
      },
    },
    404: {
      description: 'カテゴリが見つかりません',
    },
    409: {
      description: 'カテゴリが重複しています',
    },
  },
})

categories.openapi(updateRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const payload = c.req.valid('json')
  try {
    const category = await updateCategory(prisma, c, id, payload)
    return c.json(category)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('カテゴリの更新に失敗しました:', error)
    throw new HTTPException(500, { message: 'カテゴリの更新に失敗しました。' })
  }
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: categoryIdParamSchema,
  },
  responses: {
    204: {
      description: 'カテゴリを削除しました',
    },
    404: {
      description: 'カテゴリが見つかりません',
    },
    409: {
      description: '紐づく投稿が存在するため削除できません',
    },
  },
})

categories.openapi(deleteRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  try {
    await deleteCategory(prisma, c, id)
    return c.body(null, 204)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('カテゴリの削除に失敗しました:', error)
    throw new HTTPException(500, { message: 'カテゴリの削除に失敗しました。' })
  }
})

export default categories
