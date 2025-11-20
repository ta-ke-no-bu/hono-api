import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth'
import { createPresignedUpload } from '../utils/r2'

const uploads = new OpenAPIHono()

uploads.use('*', authMiddleware)

const pdfPresignRoute = createRoute({
  method: 'post',
  path: '/pdf',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              fileName: z.string().min(1),
              contentType: z.literal('application/pdf'),
              contentLength: z.number().int().positive(),
            })
            .openapi('UploadRequest'),
        },
      },
    },
  },
  responses: {
    200: {
      description: '署名付きURLを発行しました',
      content: {
        'application/json': {
          schema: z
            .object({
              uploadUrl: z.string().url(),
              objectUrl: z.string().url(),
              key: z.string().min(1),
              expiresIn: z.number().int().positive(),
            })
            .openapi('UploadResponse'),
        },
      },
    },
    400: {
      description: '不正なリクエストです',
    },
    500: {
      description: 'アップロード設定が不足しています',
    },
  },
})

uploads.openapi(pdfPresignRoute, async (c) => {
  const payload = c.req.valid('json')
  const result = await createPresignedUpload(c, {
    fileName: payload.fileName,
    contentType: payload.contentType,
    contentLength: payload.contentLength,
    allowedContentTypes: ['application/pdf'],
    maxFileSize: 10 * 1024 * 1024,
    objectKeyPrefix: 'documents',
    fallbackExtension: '.pdf',
  })
  return c.json(result)
})

const imageContentTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'] as const

const imagePresignRoute = createRoute({
  method: 'post',
  path: '/image',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              fileName: z.string().min(1),
              contentType: z.enum(imageContentTypes),
              contentLength: z.number().int().positive(),
            })
            .openapi('ImageUploadRequest'),
        },
      },
    },
  },
  responses: {
    200: {
      description: '署名付きURLを発行しました',
      content: {
        'application/json': {
          schema: z
            .object({
              uploadUrl: z.string().url(),
              objectUrl: z.string().url(),
              key: z.string().min(1),
              expiresIn: z.number().int().positive(),
            })
            .openapi('ImageUploadResponse'),
        },
      },
    },
    400: {
      description: '不正なリクエストです',
    },
    500: {
      description: 'アップロード設定が不足しています',
    },
  },
})

uploads.openapi(imagePresignRoute, async (c) => {
  const payload = c.req.valid('json')
  const result = await createPresignedUpload(c, {
    fileName: payload.fileName,
    contentType: payload.contentType,
    contentLength: payload.contentLength,
    allowedContentTypes: [...imageContentTypes],
    maxFileSize: 5 * 1024 * 1024,
    objectKeyPrefix: 'images',
  })
  return c.json(result)
})

export default uploads
