import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { getContactFormDefinition } from '../config/contactFormDefinitions'
import { authMiddleware } from '../middleware/auth'
import {
  contactFieldDefinitionSchema,
  contactFormCreateSchema,
  contactFormResponseSchema,
  contactFormUpdateSchema,
} from '../schemas/contactForm'
import {
  createContactForm,
  deleteContactForm,
  getContactFormById,
  getContactFormBySlug,
  listContactForms,
  updateContactForm,
} from '../services/contactForm'
import { getPrismaClient } from '../utils/prisma'

const contactForms = new OpenAPIHono()

contactForms.use('*', async (c, next) => {
  const path = c.req.path
  if (path.startsWith('/app/api/contact/forms/public')) {
    return next()
  }
  return authMiddleware(c, next)
})

const listFormsRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'フォーム一覧の取得に成功しました',
      content: {
        'application/json': {
          schema: z.array(contactFormResponseSchema),
        },
      },
    },
  },
})

contactForms.openapi(listFormsRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const forms = await listContactForms(prisma)
  return c.json(forms)
})

const createFormRoute = createRoute({
  method: 'post',
  path: '/',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: contactFormCreateSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'フォームを作成しました',
      content: {
        'application/json': {
          schema: contactFormResponseSchema,
        },
      },
    },
  },
})

contactForms.openapi(createFormRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const body = c.req.valid('json')
  try {
    const form = await createContactForm(prisma, body)
    return c.json(form, 201)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('フォーム作成中にエラーが発生しました:', error)
    throw new HTTPException(500, { message: 'フォームの作成に失敗しました' })
  }
})

const formIdParam = z.object({
  id: z.string().min(1),
})

const getFormRoute = createRoute({
  method: 'get',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: formIdParam,
  },
  responses: {
    200: {
      description: 'フォームの詳細を取得しました',
      content: {
        'application/json': {
          schema: contactFormResponseSchema,
        },
      },
    },
    404: {
      description: 'フォームが見つかりません',
    },
  },
})

contactForms.openapi(getFormRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const form = await getContactFormById(prisma, id)
  if (!form) {
    return c.json({ message: 'Form not found' }, 404)
  }
  return c.json(form)
})

const updateFormRoute = createRoute({
  method: 'put',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: formIdParam,
    body: {
      content: {
        'application/json': {
          schema: contactFormUpdateSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'フォームを更新しました',
      content: {
        'application/json': {
          schema: contactFormResponseSchema,
        },
      },
    },
    404: {
      description: 'フォームが見つかりません',
    },
  },
})

contactForms.openapi(updateFormRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  try {
    const form = await updateContactForm(prisma, id, body)
    return c.json(form)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('フォーム更新中にエラーが発生しました:', error)
    throw new HTTPException(500, { message: 'フォームの更新に失敗しました' })
  }
})

const deleteFormRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  security: [{ bearerAuth: [] }],
  request: {
    params: formIdParam,
  },
  responses: {
    204: {
      description: 'フォームを削除しました',
    },
    404: {
      description: 'フォームが見つかりません',
    },
  },
})

contactForms.openapi(deleteFormRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { id } = c.req.valid('param')
  try {
    await deleteContactForm(prisma, id)
    return c.body(null, 204)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('フォーム削除中にエラーが発生しました:', error)
    throw new HTTPException(500, { message: 'フォームの削除に失敗しました' })
  }
})

const publicFormResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  successMessage: z.string().nullable(),
  replyToFieldSlug: z.string().nullable(),
  turnstileEnabled: z.boolean(),
  fields: z.array(contactFieldDefinitionSchema),
})

const getPublicFormRoute = createRoute({
  method: 'get',
  path: '/public/{slug}',
  request: {
    params: z.object({
      slug: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: '公開フォーム情報を取得しました',
      content: {
        'application/json': {
          schema: publicFormResponseSchema,
        },
      },
    },
    404: {
      description: 'フォームが見つかりません',
    },
  },
})

contactForms.openapi(getPublicFormRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const { slug } = c.req.valid('param')

  const [form, definition] = await Promise.all([
    getContactFormBySlug(prisma, slug),
    Promise.resolve(getContactFormDefinition(slug)),
  ])

  if (!form || !form.isActive || !definition) {
    return c.json({ message: 'Form not found' }, 404)
  }

  return c.json({
    id: form.id,
    name: form.name,
    slug: form.slug,
    description: form.description ?? null,
    successMessage: form.successMessage ?? definition.successMessage ?? null,
    replyToFieldSlug: form.replyToFieldSlug ?? null,
    turnstileEnabled: form.turnstileEnabled,
    fields: definition.fields,
  })
})

export default contactForms
