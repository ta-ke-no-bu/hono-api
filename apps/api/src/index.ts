import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi' // createRouteをインポート
import type { PrismaClient } from '@prisma/client'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import { authMiddleware } from './middleware/auth' // Add this import
import { rateLimit } from './middleware/rateLimit'
import auditLogsRoutes from './routes/auditLogs' // auditLogsRoutesをインポート
import authRoutes from './routes/auth' // authRoutesをインポート
import categoriesRoutes from './routes/categories'
import contactRoutes from './routes/contact' // contactRoutesをインポート
import contactFormsRoutes from './routes/contactForms'
import jobsRoutes from './routes/jobs'
import logsRoutes from './routes/logs'
import postSettingsRoutes from './routes/postSettings'
import postsRoutes from './routes/posts'
import settingsRoutes from './routes/settings'
import uploadsRoutes from './routes/uploads'
import usersRoutes from './routes/users' // usersRoutesをインポート
import webhooksRoutes from './routes/webhooks' // webhooksRoutesをインポート
import { type envSchema, getValidatedEnv } from './utils/env'
import { errorHandler } from './utils/errorHandler'
import { prismaMiddleware } from './utils/prisma'
import { verifyTurnstileToken } from './utils/turnstile'

type Bindings = {
  hono_db: D1Database | undefined
  prisma?: PrismaClient
  validatedEnv: z.infer<typeof envSchema>
}

const app = new OpenAPIHono<{ Bindings: Bindings }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      console.error('Zod Validation Error:', result.error.flatten()) // Add this line
      return c.json(
        {
          ok: false,
          message: '入力内容に誤りがあります。',
          errors: result.error.flatten(),
        },
        422
      )
    }
  },
})

// 環境変数検証ミドルウェア
app.use('*', async (c, next) => {
  const validatedEnv = getValidatedEnv(c)
  if (validatedEnv.NODE_ENV === 'production' && validatedEnv.BYPASS_TURNSTILE === true) {
    console.error('[security] BYPASS_TURNSTILE must be false in production environment.')
    return c.json(
      {
        message: 'Turnstileバイパスは本番環境で無効化してください。',
      },
      500
    )
  }
  c.set('validatedEnv', validatedEnv)
  await next()
})

// PrismaミドルウェアはAPI配下に限定して適用 (不要なリクエストでDB初期化しない)
app.use('/app/api/*', prismaMiddleware)

// ロガーミドルウェアを適用 (チェーンの早い段階に配置)
app.use(logger())

// セキュリティヘッダーを適用
app.use(
  secureHeaders({
    nonce: true, // nonceを有効にする
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
        referrerPolicy: ['strict-origin-when-cross-origin'],
        permissionsPolicy: {
          camera: ["'none'"],
          microphone: ["'none'"],
          geolocation: ["'none'"],
          payment: ["'none'"],
        },
      },
    },
  })
)

// レート制限ミドルウェアを適用 (例: 15分間に100リクエスト)
app.use(
  '*',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    keyGenerator: (c) => c.req.header('CF-Connecting-IP') ?? c.req.ip ?? undefined, // IPが取得できない場合はundefinedを返す
  })
)

// CORS制御を適用
app.use('/app/api/*', async (c, next) => {
  const env = c.get('validatedEnv')
  const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : []
  const requestOrigin = c.req.header('Origin') ?? ''
  const isAllowedOrigin =
    requestOrigin === ''
      ? allowedOrigins.length > 0
      : allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)

  const resolvedOrigin = requestOrigin !== '' && isAllowedOrigin ? requestOrigin : ''

  const allowHeaders = [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With',
    'X-Custom-Header',
    'Upgrade-Insecure-Requests',
  ]

  const allowMethods = ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS']

  if (requestOrigin !== '' && !isAllowedOrigin) {
    console.warn(`CORS request rejected from origin: ${requestOrigin}`)
    return c.json({ message: 'CORS policy prevents this request.' }, 403)
  }

  if (c.req.method === 'OPTIONS') {
    if (!resolvedOrigin) {
      console.warn(`CORS preflight rejected from origin: ${requestOrigin || 'unknown'}`)
      return c.json({ message: 'CORS policy prevents this request.' }, 403)
    }

    c.header('Access-Control-Allow-Origin', resolvedOrigin)
    c.header('Vary', 'Origin')
    c.header('Access-Control-Allow-Credentials', 'true')
    c.header('Access-Control-Allow-Headers', allowHeaders.join(', '))
    c.header('Access-Control-Allow-Methods', allowMethods.join(', '))
    c.header('Access-Control-Max-Age', '600')
    return c.body(null, 204)
  }

  await next()

  if (resolvedOrigin) {
    c.header('Access-Control-Allow-Origin', resolvedOrigin)
    c.header('Vary', 'Origin')
    c.header('Access-Control-Allow-Credentials', 'true')
    c.header('Access-Control-Expose-Headers', 'Content-Length')
  }
})

const WEBHOOK_PATH_PREFIX = '/app/api/webhooks'

// CSRFミドルウェアを適用（Webhookは除外）
const csrfMiddleware = csrf()
app.use('/app/api/*', async (c, next) => {
  if (c.req.path.startsWith(WEBHOOK_PATH_PREFIX)) {
    return next()
  }
  const authHeader = c.req.header('Authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    return next()
  }
  return csrfMiddleware(c, next)
})

// Turnstile検証ルート (デモンストレーション用)
app.post('/app/api/verify-turnstile', async (c) => {
  const { 'cf-turnstile-response': token } = await c.req.json()

  if (!token) {
    return c.json({ success: false, message: 'Turnstile token missing' }, 400)
  }

  const isValid = await verifyTurnstileToken(token, c)

  if (isValid) {
    return c.json({ success: true, message: 'Turnstile verification successful' })
  }
  return c.json({ success: false, message: 'Turnstile verification failed' }, 403)
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})
app.get('/test', (c) => {
  return c.text('test')
})

// OpenAPIドキュメントのカスタムルート
app.get('/doc', async (c) => {
  // デフォルトのOpenAPIドキュメントを取得
  const response = await app.getOpenAPIDocument({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Hono API',
      description: 'API documentation with JWT authentication. Use the Authorize button to set your Bearer token.',
    },
  })

  // securitySchemesを手動で追加
  response.components = response.components || {}
  response.components.securitySchemes = {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter your JWT token (without Bearer prefix)',
    },
  }

  return c.json(response)
})

// Swagger UIのルート
app.get(
  '/swagger',
  swaggerUI({
    url: '/doc',
    config: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      requestInterceptor: (req) => {
        // Bearer tokenをAuthorizationヘッダーに追加
        return req
      },
    },
  })
)

// ルートを登録
app.route('/app/api/auth', authRoutes)
app.route('/app/api/contact/forms', contactFormsRoutes)
app.route('/app/api/contact', contactRoutes)
app.route('/app/api/uploads', uploadsRoutes)
app.route('/app/api/categories', categoriesRoutes)
app.route('/app/api/post-settings', postSettingsRoutes)
app.route('/app/api/posts', postsRoutes)
app.route('/app/api/jobs', jobsRoutes)

// 認証が必要なルートにauthMiddlewareを適用（Webhookは除外）
app.use('/app/api/*', async (c, next) => {
  if (c.req.path.startsWith(WEBHOOK_PATH_PREFIX)) {
    return next()
  }
  return authMiddleware(c, next)
})

// 認証済みユーザー向けのレート制限ミドルウェアを適用 (例: 1分間に30リクエスト)
app.use(
  '/app/api/*', // authMiddlewareが適用されるパスと同じ
  async (c, next) => {
    // authMiddlewareがjwtPayloadを設定した後なので、ここで取得できる
    const jwtPayload = c.get('jwtPayload')
    const userId = jwtPayload?.userId
    if (userId) {
      return rateLimit({
        windowMs: 60 * 1000, // 1分間
        limit: 30, // 30リクエスト
        keyGenerator: () => `user-${userId}`, // ユーザーIDをキーとする
      })(c, next)
    }
    // 認証されていない、またはuserIdがない場合は次のミドルウェアへ
    await next()
  }
)

app.route('/app/api/webhooks', webhooksRoutes)
app.route('/app/api/users', usersRoutes)
app.route('/app/api/logs', logsRoutes)
app.route('/app/api/audit-logs', auditLogsRoutes) // AuditLogsルートを追加
app.route('/app/api/settings', settingsRoutes)

// 保護されたルートの定義
const protectedRoute = createRoute({
  method: 'get',
  path: '/app/api/protected',
  security: [
    {
      bearerAuth: [], // bearerAuthセキュリティスキームを適用
    },
  ],
  responses: {
    200: {
      description: '保護されたリソースへのアクセス成功',
      content: {
        'application/json': {
          schema: z
            .object({
              message: z.string(),
              user: z.string(),
            })
            .openapi({
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Welcome! This is a protected route.' },
                user: { type: 'string', example: 'user@example.com' },
              },
            }),
        },
      },
    },
    401: {
      description: '認証失敗',
      content: {
        'application/json': {
          schema: z
            .object({
              message: z.string(),
            })
            .openapi({
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Unauthorized' },
              },
            }),
        },
      },
    },
  },
})

// app.openapi()を使用してルートとハンドラを接続
app.openapi(protectedRoute, async (c) => {
  // 手動で認証チェックを実行
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthorized: No token provided' }, 401)
  }

  const token = authHeader.split(' ')[1]

  // 認証サービスをインポートして使用
  const { verifyToken } = await import('./services/auth')
  const decoded = await verifyToken(token, c)

  if (!decoded) {
    return c.json({ message: 'Unauthorized: Invalid token' }, 401)
  }

  return c.json({
    message: `Welcome, ${decoded.email}! This is a protected route.`,
    user: decoded.email,
  })
})

// エラーハンドラーを登録
app.onError(errorHandler)

app.notFound((c) => {
  console.error(`404 Not Found: ${c.req.method} ${c.req.url}`)
  return c.json({ message: 'Not Found', path: c.req.url }, 404)
})

export default app
