import type { Context } from 'hono'
import { z } from 'zod'

// 環境変数スキーマを定義
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_BASE_URL: z.string().url().optional(), // Cloudflare環境では不要な場合がある
  API_PORT: z.coerce.number().int().positive().default(8787).optional(), // Cloudflare環境では不要
  DATABASE_URL: z.string().optional(), // D1バインディングを使うため、URLは不要
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters long'),
  AUDIT_LOG_ENCRYPTION_KEY: z.string().min(32, 'Audit log encryption key must be at least 32 characters long'),
  ALLOWED_ORIGINS: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1, 'Turnstile secret key is required'),
  TURNSTILE_SITE_KEY: z.string().min(1, 'Turnstile site key is required'),
  LOGINS_TURNSTILE_SECRET_KEY: z.string().min(1, 'Login Turnstile secret key is required'), // これを追加
  LOGINS_TURNSTILE_SITE_KEY: z.string().min(1, 'Login Turnstile site key is required'), // これを追加
  RESEND_WEBHOOK_SECRET: z.string().min(32, 'Resend webhook secret must be at least 32 characters long'),
  CRON_JOB_SECRET: z.string().min(16, 'Cron job secret must be at least 16 characters long'),
  BYPASS_TURNSTILE: z
    .preprocess((value) => {
      if (value === 'true' || value === true) {
        return true
      }
      if (value === 'false' || value === false) {
        return false
      }
      return undefined
    }, z.boolean())
    .optional(),
  RESEND_API_KEY: z.string().min(1, 'Resend API key is required'),
  ADMIN_EMAIL: z.string().email('Invalid admin email format').optional(),
  FROM_EMAIL: z.string().email('Invalid from email format').optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_SECRET_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET: z.string().optional(),
  CLOUDFLARE_R2_PUBLIC_BASE_URL: z.string().url().optional(),
  hono_db: z.any(), // D1 binding
})

// Honoのコンテキストから環境変数を取得・検証する関数
export const getValidatedEnv = (c: Context) => {
  // Cloudflare Workers では c.env にシークレットやバインディングが格納されるため、process.env とマージする
  const contextEnv = (c.env ?? {}) as Record<string, unknown>
  const systemEnv = typeof process !== 'undefined' && process.env ? Object.fromEntries(Object.entries(process.env)) : {}

  const sourceEnv: Record<string, unknown> = { ...systemEnv }

  // Override with contextEnv values if they exist
  for (const key in contextEnv) {
    if (Object.prototype.hasOwnProperty.call(contextEnv, key) && contextEnv[key] !== undefined) {
      sourceEnv[key] = contextEnv[key]
    }
  }

  const parsedEnv = envSchema.safeParse(sourceEnv)

  if (!parsedEnv.success) {
    console.error('❌ 無効な環境変数:', parsedEnv.error.flatten().fieldErrors)
    throw new Error('無効な環境変数')
  }

  return parsedEnv.data
}
