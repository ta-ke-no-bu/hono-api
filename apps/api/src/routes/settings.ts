import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import {
  MailSettingNotConfiguredError,
  getMailSettings,
  mailSettingSchema,
  updateMailSettings,
} from '../services/settings'
import { getPrismaClient } from '../utils/prisma'

const settings = new OpenAPIHono()

const mailSettingsResponseSchema = mailSettingSchema.openapi({
  title: 'MailSettingsResponse',
})

const getMailSettingsRoute = createRoute({
  method: 'get',
  path: '/contact-email',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'メール設定の取得に成功しました',
      content: {
        'application/json': {
          schema: mailSettingsResponseSchema,
        },
      },
    },
    404: {
      description: 'メール設定が見つかりません',
    },
  },
})

settings.openapi(getMailSettingsRoute, async (c) => {
  const prisma = getPrismaClient(c)

  try {
    const data = await getMailSettings(prisma)
    return c.json(data)
  } catch (error) {
    console.error('メール設定の取得に失敗しました:', error)
    if (error instanceof MailSettingNotConfiguredError) {
      throw new HTTPException(404, { message: 'メール設定が未登録です' })
    }
    throw new HTTPException(500, { message: 'メール設定の取得に失敗しました' })
  }
})

const updateMailSettingsRoute = createRoute({
  method: 'put',
  path: '/contact-email',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: mailSettingSchema.openapi({
            title: 'MailSettingsRequest',
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'メール設定を更新しました',
      content: {
        'application/json': {
          schema: mailSettingsResponseSchema,
        },
      },
    },
    422: {
      description: '入力データが無効です',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
})

settings.openapi(updateMailSettingsRoute, async (c) => {
  const prisma = getPrismaClient(c)
  const body = c.req.valid('json')

  try {
    const updated = await updateMailSettings(prisma, c, body)
    return c.json(updated)
  } catch (error) {
    console.error('メール設定の更新に失敗しました:', error)
    throw new HTTPException(500, { message: 'メール設定の更新に失敗しました' })
  }
})

export default settings
