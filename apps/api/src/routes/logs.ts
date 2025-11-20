import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware } from '../middleware/auth'
import { errorLogDataSchema, errorLogsResponseSchema } from '../schemas/log'
import { getPrismaClient } from '../utils/prisma'

const logs = new OpenAPIHono()

logs.use('*', authMiddleware)

const formatLog = (log: {
  id: number
  statusCode: number | null
  path: string | null
  errorMessage: string
  stackTrace: string | null
  createdAt: Date
}) => ({
  id: log.id,
  statusCode: log.statusCode,
  path: log.path,
  errorMessage: log.errorMessage,
  stackTrace: log.stackTrace,
  createdAt: log.createdAt.toISOString(),
})

const getErrorLogsRoute = createRoute({
  method: 'get',
  path: '/errors',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: errorLogsResponseSchema,
        },
      },
      description: 'エラーログ一覧の取得に成功しました',
    },
    401: {
      description: '認証に失敗しました',
    },
  },
})

logs.openapi(getErrorLogsRoute, async (c) => {
  const prisma = getPrismaClient(c)

  try {
    const errorLogs = await prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return c.json(errorLogs.map(formatLog))
  } catch (error) {
    console.error('エラーログ一覧の取得中にエラーが発生しました:', error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

const getErrorLogByIdRoute = createRoute({
  method: 'get',
  path: '/errors/{id}',
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
          schema: errorLogDataSchema,
        },
      },
      description: '指定されたIDのエラーログを取得しました',
    },
    401: {
      description: '認証に失敗しました',
    },
    404: {
      description: '指定されたIDのエラーログが見つかりません',
    },
  },
})

logs.openapi(getErrorLogByIdRoute, async (c) => {
  const { id } = c.req.valid('param')
  const prisma = getPrismaClient(c)

  try {
    const errorLog = await prisma.errorLog.findUnique({ where: { id } })

    if (!errorLog) {
      return c.json({ message: 'Error log not found' }, 404)
    }

    return c.json(formatLog(errorLog))
  } catch (error) {
    console.error(`ID:${id} のエラーログ取得中にエラー:`, error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

export default logs
