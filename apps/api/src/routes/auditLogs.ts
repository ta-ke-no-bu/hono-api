import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth'
import { decrypt } from '../utils/crypto'
import { getPrismaClient } from '../utils/prisma'

const auditLogs = new OpenAPIHono()

auditLogs.use('*', authMiddleware)

const auditLogSchema = z.object({
  id: z.number().int(),
  createdAt: z.string().datetime(),
  userId: z.number().int().nullable(),
  eventType: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
})

const auditLogResponseSchema = z.object({
  logs: z.array(auditLogSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
})

const getAuditLogsRoute = createRoute({
  method: 'get',
  path: '/audit-logs',
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    }),
  },
  responses: {
    200: {
      description: '監査ログの取得成功',
      content: {
        'application/json': {
          schema: auditLogResponseSchema,
        },
      },
    },
    401: {
      description: '認証に失敗しました',
    },
  },
})

auditLogs.openapi(getAuditLogsRoute, async (c) => {
  const { page, limit } = c.req.valid('query')
  const prisma = getPrismaClient(c)
  const env = c.get('validatedEnv')

  const offset = (page - 1) * limit

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.auditLog.count(),
  ])

  const mapped = logs.map((log) => {
    let parsedDetails: Record<string, unknown> | null = null

    if (log.details) {
      try {
        const decrypted = decrypt(log.details, env.AUDIT_LOG_ENCRYPTION_KEY)
        const parsed = JSON.parse(decrypted)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedDetails = parsed as Record<string, unknown>
        }
      } catch (error) {
        console.warn('Failed to decrypt audit log details:', error)
        parsedDetails = null
      }
    }

    return {
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      userId: log.userId,
      eventType: log.eventType,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: parsedDetails,
    }
  })

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return c.json({
    logs: mapped,
    total,
    page,
    limit,
    totalPages,
  })
})

export default auditLogs
