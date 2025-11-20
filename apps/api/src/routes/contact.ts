import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware } from '../middleware/auth'
import {
  contactSubmissionDetailSchema,
  contactSubmissionListSchema,
  contactSubmissionRequestSchema,
  contactSubmissionResponseSchema,
  contactSubmissionSummarySchema,
} from '../schemas/contact'
import {
  getContactSubmissionDetail,
  listContactSubmissions,
  submitContactForm,
  updateContactSubmissionStatus,
} from '../services/contact'
import { getPrismaClient } from '../utils/prisma'

const contact = new OpenAPIHono()

contact.use('*', async (c, next) => {
  const path = c.req.path
  const method = c.req.method
  if (method === 'POST' && path === '/app/api/contact') {
    return next()
  }
  return authMiddleware(c, next)
})

const createContactRoute = createRoute({
  path: '/',
  method: 'post',
  request: {
    body: {
      content: {
        'application/json': {
          schema: contactSubmissionRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: contactSubmissionResponseSchema,
        },
      },
      description: 'お問い合わせが正常に送信されました',
    },
    400: {
      description: 'リクエスト形式が不正です',
    },
    403: {
      description: 'Turnstile 検証に失敗しました',
    },
    404: {
      description: 'フォームが見つかりませんでした',
    },
  },
})

contact.openapi(createContactRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const body = c.req.valid('json')

  try {
    const { submission, successMessage } = await submitContactForm(body, prisma, c)
    return c.json(
      {
        success: true,
        message: 'お問い合わせが正常に送信されました',
        contactId: submission.id,
        successMessage: successMessage ?? null,
      },
      201
    )
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('お問い合わせ処理中にエラーが発生しました:', error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

const contactListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
  })
  .openapi('ContactListQuery')

const getContactsRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  request: {
    query: contactListQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: contactSubmissionListSchema,
        },
      },
      description: '問い合わせ一覧の取得に成功しました',
    },
    401: {
      description: '認証に失敗しました',
    },
  },
})

contact.openapi(getContactsRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { limit: rawLimit, page: rawPage } = c.req.valid('query')
  const limit = rawLimit ?? 20
  const page = rawPage ?? 1
  const offset = (page - 1) * limit
  try {
    const [totalCount, submissions] = await Promise.all([
      prisma.contactSubmission.count(),
      listContactSubmissions(prisma, { limit, offset }),
    ])

    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit)
    return c.json({
      data: submissions,
      meta: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      },
    })
  } catch (error) {
    console.error('問い合わせ一覧の取得中にエラーが発生しました:', error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

const getContactByIdRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid('Invalid ID format'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: contactSubmissionDetailSchema,
        },
      },
      description: '指定されたIDの問い合わせを取得しました',
    },
    401: {
      description: '認証に失敗しました',
    },
    404: {
      description: '指定されたIDの問い合わせが見つかりません',
    },
  },
})

contact.openapi(getContactByIdRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')

  try {
    const submission = await getContactSubmissionDetail(prisma, id)
    if (!submission) {
      return c.json({ message: 'Contact not found' }, 404)
    }
    return c.json(submission)
  } catch (error) {
    console.error(`ID:${id} の問い合わせ取得中にエラー:`, error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

const updateContactSchema = z
  .object({
    emailStatus: z.string().min(1),
  })
  .openapi('UpdateContactSubmission')

const updateContactRoute = createRoute({
  method: 'put',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid('Invalid ID format'),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateContactSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: contactSubmissionSummarySchema,
        },
      },
      description: '問い合わせ情報を更新しました',
    },
    401: {
      description: '認証に失敗しました',
    },
    404: {
      description: '指定されたIDの問い合わせが見つかりません',
    },
  },
})

contact.openapi(updateContactRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const body = c.req.valid('json') as z.infer<typeof updateContactSchema>

  try {
    const updated = await updateContactSubmissionStatus(prisma, id, body.emailStatus)
    return c.json(updated)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2025') {
      return c.json({ message: 'Contact not found' }, 404)
    }
    console.error(`ID:${id} の問い合わせ更新中にエラー:`, error)
    throw new HTTPException(500, { message: 'サーバーエラーが発生しました' })
  }
})

export default contact
