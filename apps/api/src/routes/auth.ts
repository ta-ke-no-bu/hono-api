import { OpenAPIHono, createRoute, extendZodWithOpenApi } from '@hono/zod-openapi'
import { zValidator } from '@hono/zod-validator'
import { setCookie } from 'hono/cookie'
import { html } from 'hono/html'
import xss from 'xss'
import { z } from 'zod'
import { LoginError, type LoginResult, loginUser, registerUser } from '../services/auth' // LoginResult, LoginErrorをインポート
import { createAuditLog } from '../utils/auditLog' // これを追加
import { getValidatedEnv } from '../utils/env'
import { getPrismaClient } from '../utils/prisma'
import { verifyTurnstileToken } from '../utils/turnstile'

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

extendZodWithOpenApi(z)

// パスパラメータのスキーマを定義 (既存の /:username ルート用)
const usernameSchema = z.object({
  username: z.string().min(1).max(50), // 例: 1文字以上50文字以下の文字列
})

// ユーザー登録リクエストボディのスキーマ
const registerSchema = z
  .object({
    email: z.string().trim().email('有効なメールアドレスを入力してください。').openapi({ example: 'test@example.com' }),
    password: z
      .string()
      .min(12, 'パスワードは12文字以上である必要があります。')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
        'パスワードには大文字、小文字、数字、記号をそれぞれ1つ以上含める必要があります。'
      )
      .max(72)
      .openapi({ example: 'password123!@#' }),
    name: z
      .string()
      .trim()
      .min(1, '名前は1文字以上である必要があります。')
      .max(50, '名前は50文字以下である必要があります。')
      .optional()
      .openapi({ example: 'Test User' }),
  })
  .openapi({ type: 'object', title: 'RegisterRequest' })

// ユーザーログインリクエストボディのスキーマ
const loginSchema = z
  .object({
    email: z.string().trim().email('有効なメールアドレスを入力してください。').openapi({ example: 'test@example.com' }),
    password: z.string().min(1, 'パスワードを入力してください。').max(72).openapi({ example: 'password123' }),
    turnstileToken: z.string().optional().openapi({ example: 'turnstile_token_here' }),
  })
  .openapi({ type: 'object', title: 'LoginRequest' })

// ユーザー登録レスポンスのスキーマ
const registerResponseSchema = z
  .object({
    message: z.string().openapi({ example: 'User registered successfully' }),
    userId: z.number().openapi({ example: 1 }),
  })
  .openapi({ type: 'object', title: 'RegisterResponse' })

// ユーザーログインレスポンスのスキーマ
const loginResponseSchema = z
  .object({
    message: z.string().openapi({ example: 'Login successful' }),
    token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
  })
  .openapi({ type: 'object', title: 'LoginResponse' })

// ユーザー登録ルートの定義
const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  request: {
    body: {
      content: {
        'application/json': {
          schema: registerSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'ユーザー登録成功',
      content: {
        'application/json': {
          schema: registerResponseSchema,
        },
      },
    },
    409: {
      description: 'メールアドレスが既に登録済み',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }).openapi({ type: 'object' }),
        },
      },
    },
    500: {
      description: 'サーバーエラー',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }).openapi({ type: 'object' }),
        },
      },
    },
  },
})

// ユーザーログインルートの定義
const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: loginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'ログイン成功',
      content: {
        'application/json': {
          schema: loginResponseSchema,
        },
      },
    },
    401: {
      description: '認証失敗',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }).openapi({ type: 'object' }),
        },
      },
    },
    403: {
      description: 'アカウントロック',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }).openapi({ type: 'object' }),
        },
      },
    },
    500: {
      description: 'サーバーエラー',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }).openapi({ type: 'object' }),
        },
      },
    },
  },
})

const auth = new OpenAPIHono()

// ユーザー登録ルートをOpenAPIに登録
auth.openapi(registerRoute, async (c) => {
  const { email, password, name } = c.req.valid('json')
  const prisma = getPrismaClient(c)
  const safeEmail = xss(email) // emailもサニタイズ
  const safeName = name ? xss(name) : undefined

  try {
    const user = await registerUser(safeEmail, password, prisma, safeName) // サニタイズされたemailを使用
    return c.json({ message: 'ユーザー登録に成功しました。', userId: user.id }, 201)
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      // Prisma unique constraint violation
      return c.json({ message: 'メールアドレスは既に登録されています。' }, 409)
    }
    console.error('Registration error:', error)
    return c.json({ message: 'サーバー内部エラーが発生しました。' }, 500)
  }
})

// ユーザーログインルートをOpenAPIに登録
auth.openapi(loginRoute, async (c) => {
  const { email, password, turnstileToken } = c.req.valid('json')
  const prisma = getPrismaClient(c)
  const env = getValidatedEnv(c)
  const safeEmail = xss(email)

  try {
    // Turnstile検証（全環境で必須）
    if (!turnstileToken || turnstileToken.length === 0) {
      return c.json({ message: 'Turnstileトークンが提供されていません。' }, 400)
    }

    const isTurnstileValid = await verifyTurnstileToken(turnstileToken, c)
    if (!isTurnstileValid) {
      // 監査ログを追加
      await createAuditLog(prisma, c, 'LOGIN_FAILED', undefined, {
        email: safeEmail,
        reason: 'Turnstile verification failed',
      })
      return c.json({ message: 'Turnstile検証に失敗しました。時間をおいて再試行してください。' }, 400)
    }

    const result: LoginResult = await loginUser(safeEmail, password, prisma, c) // サニタイズされたemailを使用

    if ('type' in result) {
      // LoginErrorの場合
      if (result.type === 'AccountLocked') {
        return c.json({ message: result.message }, 403) // Forbidden
      }
      return c.json({ message: result.message }, 401) // Unauthorized (InvalidCredentials)
    }

    // ログイン成功の場合
    setCookie(c, 'session', result.token, {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60,
    })
    return c.json({ message: 'ログインに成功しました。', token: result.token }, 200)
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ message: 'サーバー内部エラーが発生しました。' }, 500)
  }
})

auth.get('/:username', zValidator('param', usernameSchema), (c) => {
  const { username } = c.req.valid('param')
  return c.html(
    html`<!doctype html>
        <h1>Hello from Auth, ${xss(username)}!</h1>`
  )
})

export default auth
