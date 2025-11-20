import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware } from '../middleware/auth'
import { updateUserSchema, userDataSchema, usersResponseSchema } from '../schemas/user'
import { getPrismaClient } from '../utils/prisma'

const isPrismaError = (error: unknown, code?: string): error is { code: string } => {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const prismaError = error as { code?: unknown }
  if (typeof prismaError.code !== 'string') {
    return false
  }
  return code ? prismaError.code === code : true
}

const users = new OpenAPIHono()

users.use('*', authMiddleware)

const formatUser = (user: { id: number; email: string; name: string | null; createdAt: Date; updatedAt: Date }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
})

const getUsersRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: usersResponseSchema,
        },
      },
      description: 'ユーザー一覧の取得に成功しました',
    },
    401: {
      description: '認証に失敗しました',
    },
  },
})

users.openapi(getUsersRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const currentUser = c.get('user')
  try {
    const self = await prisma.user.findUnique({ where: { id: currentUser.userId } })
    if (!self) {
      return c.json({ message: 'User not found' }, 404)
    }
    return c.json([formatUser(self)])
  } catch (error) {
    console.error('ユーザー一覧の取得中にエラーが発生しました:', error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

const getUserByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: userDataSchema,
        },
      },
      description: '指定されたIDのユーザーを取得しました',
    },
    401: {
      description: '認証に失敗しました',
    },
    404: {
      description: '指定されたIDのユーザーが見つかりません',
    },
  },
})

users.openapi(getUserByIdRoute, async (c) => {
  const { id } = c.req.valid('param')
  const prisma = getPrismaClient(c)
  const currentUser = c.get('user')
  if (currentUser.userId !== id) {
    throw new HTTPException(403, { message: '他のユーザー情報へアクセスする権限がありません。' })
  }
  try {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return c.json({ message: 'User not found' }, 404)
    }
    return c.json(formatUser(user))
  } catch (error) {
    console.error(`ID:${id} のユーザー取得中にエラー:`, error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

const updateUserRoute = createRoute({
  method: 'put',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateUserSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: userDataSchema,
        },
      },
      description: 'ユーザー情報を更新しました',
    },
    400: {
      description: 'リクエストボディが不正です',
    },
    401: {
      description: '認証に失敗しました',
    },
    404: {
      description: '指定されたIDのユーザーが見つかりません',
    },
  },
})

users.openapi(updateUserRoute, async (c) => {
  const { id } = c.req.valid('param')
  const payload = c.req.valid('json')
  const currentUser = c.get('user')
  if (currentUser.userId !== id) {
    throw new HTTPException(403, { message: '他のユーザーを更新する権限がありません。' })
  }
  if (!payload.email && payload.name === undefined) {
    return c.json({ message: '更新項目が指定されていません' }, 400)
  }
  const prisma = getPrismaClient(c)
  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: payload,
    })
    return c.json(formatUser(updatedUser))
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      return c.json({ message: 'User not found' }, 404)
    }
    console.error(`ID:${id} のユーザー更新中にエラー:`, error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

const deleteUserRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
      description: 'ユーザーを削除しました',
    },
    401: {
      description: '認証に失敗しました',
    },
    404: {
      description: '指定されたIDのユーザーが見つかりません',
    },
  },
})

users.openapi(deleteUserRoute, async (c) => {
  const { id } = c.req.valid('param')
  const prisma = getPrismaClient(c)
  const currentUser = c.get('user')
  if (currentUser.userId !== id) {
    throw new HTTPException(403, { message: '他のユーザーを削除する権限がありません。' })
  }
  try {
    await prisma.user.delete({ where: { id } })
    return c.json({ message: 'User deleted successfully' })
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      return c.json({ message: 'User not found' }, 404)
    }
    console.error(`ID:${id} のユーザー削除中にエラー:`, error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

export default users
