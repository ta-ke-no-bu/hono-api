import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import {
  customFieldDefinitionCreateSchema,
  customFieldDefinitionIdParamSchema,
  customFieldDefinitionReorderSchema,
  customFieldDefinitionResponseSchema,
  customFieldDefinitionUpdateSchema,
  postSettingCreateSchema,
  postSettingIdParamSchema,
  postSettingListResponseSchema,
  postSettingResponseSchema,
  postSettingUpdateSchema,
} from '../schemas/postSetting'
import {
  createCustomFieldDefinition,
  createPostSetting,
  deleteCustomFieldDefinition,
  deletePostSetting,
  getPostSettingById,
  listPostSettings,
  reorderCustomFieldDefinitions,
  updateCustomFieldDefinition,
  updatePostSetting,
} from '../services/postSetting'
import { getPrismaClient } from '../utils/prisma'

const postSettings = new OpenAPIHono()

postSettings.use('*', authMiddleware)

// --- Post Settings ---

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: '投稿設定一覧の取得に成功しました',
      content: {
        'application/json': {
          schema: postSettingListResponseSchema,
        },
      },
    },
  },
})

postSettings.openapi(listRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const settings = await listPostSettings(prisma)
  return c.json(settings)
})

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: postSettingIdParamSchema,
  },
  responses: {
    200: {
      description: '投稿設定の取得に成功しました',
      content: {
        'application/json': {
          schema: postSettingResponseSchema,
        },
      },
    },
    404: {
      description: '投稿設定が見つかりません',
    },
  },
})

postSettings.openapi(getRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const setting = await getPostSettingById(prisma, id)

  if (!setting) {
    return c.json({ message: '投稿設定が見つかりません。' }, 404)
  }

  return c.json(setting)
})

const createRouteConfig = createRoute({
  method: 'post',
  path: '/',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: postSettingCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '投稿設定の作成に成功しました',
      content: {
        'application/json': {
          schema: postSettingResponseSchema,
        },
      },
    },
    400: { description: 'リクエストが不正です' },
    409: { description: 'スラッグが重複しています' },
  },
})

postSettings.openapi(createRouteConfig, async (c) => {
  const prisma = getPrismaClient(c)
  const payload = c.req.valid('json')

  try {
    const created = await createPostSetting(prisma, payload)
    return c.json(created, 201)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('投稿設定の作成に失敗しました:', error)
    throw new HTTPException(500, { message: '投稿設定の作成に失敗しました。' })
  }
})

const updateRoute = createRoute({
  method: 'put',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: postSettingIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: postSettingUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '投稿設定を更新しました',
      content: {
        'application/json': {
          schema: postSettingResponseSchema,
        },
      },
    },
    404: { description: '投稿設定が見つかりません' },
    409: { description: 'スラッグが重複しています' },
  },
})

postSettings.openapi(updateRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const payload = c.req.valid('json')

  try {
    const updated = await updatePostSetting(prisma, id, payload)
    return c.json(updated)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('投稿設定の更新に失敗しました:', error)
    throw new HTTPException(500, { message: '投稿設定の更新に失敗しました。' })
  }
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: postSettingIdParamSchema,
  },
  responses: {
    204: { description: '投稿設定を削除しました' },
    404: { description: '投稿設定が見つかりません' },
  },
})

postSettings.openapi(deleteRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')

  try {
    await deletePostSetting(prisma, id)
    return c.body(null, 204)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('投稿設定の削除に失敗しました:', error)
    throw new HTTPException(500, { message: '投稿設定の削除に失敗しました。' })
  }
})

// --- Field Definitions ---

const createDefinitionRoute = createRoute({
  method: 'post',
  path: '/{id}/definitions',
  security: [{ bearerAuth: [] }],
  request: {
    params: postSettingIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: customFieldDefinitionCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '投稿フィールド定義の作成に成功しました',
      content: {
        'application/json': {
          schema: customFieldDefinitionResponseSchema,
        },
      },
    },
    400: { description: 'リクエストが不正です' },
  },
})

postSettings.openapi(createDefinitionRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const payload = c.req.valid('json')
  payload.postSettingId = id

  try {
    const created = await createCustomFieldDefinition(prisma, payload)
    return c.json(created, 201)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('投稿フィールド定義の作成に失敗しました:', error)
    throw new HTTPException(500, { message: '投稿フィールド定義の作成に失敗しました。' })
  }
})

const updateDefinitionRoute = createRoute({
  method: 'put',
  path: '/definitions/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: customFieldDefinitionIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: customFieldDefinitionUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '投稿フィールド定義を更新しました',
      content: {
        'application/json': {
          schema: customFieldDefinitionResponseSchema,
        },
      },
    },
    404: { description: '定義が見つかりません' },
  },
})

postSettings.openapi(updateDefinitionRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const payload = c.req.valid('json')

  try {
    const updated = await updateCustomFieldDefinition(prisma, id, payload)
    return c.json(updated)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('投稿フィールド定義の更新に失敗しました:', error)
    throw new HTTPException(500, { message: '投稿フィールド定義の更新に失敗しました。' })
  }
})

const deleteDefinitionRoute = createRoute({
  method: 'delete',
  path: '/definitions/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: customFieldDefinitionIdParamSchema,
  },
  responses: {
    204: { description: '投稿フィールド定義を削除しました' },
    404: { description: '定義が見つかりません' },
  },
})

postSettings.openapi(deleteDefinitionRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')

  try {
    await deleteCustomFieldDefinition(prisma, id)
    return c.body(null, 204)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('投稿フィールド定義の削除に失敗しました:', error)
    throw new HTTPException(500, { message: '投稿フィールド定義の削除に失敗しました。' })
  }
})

const reorderDefinitionRoute = createRoute({
  method: 'post',
  path: '/definitions/reorder',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.array(customFieldDefinitionReorderSchema),
        },
      },
    },
  },
  responses: {
    200: { description: '投稿フィールド定義の順序を更新しました' },
  },
})

postSettings.openapi(reorderDefinitionRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const payload = c.req.valid('json')
  await reorderCustomFieldDefinitions(prisma, payload)
  return c.json({ success: true })
})

export default postSettings
