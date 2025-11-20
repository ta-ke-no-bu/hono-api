import type { Context } from 'hono'
import { getPrismaClient } from './prisma'

interface TurnstileVerificationResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

export const verifyTurnstileToken = async (token: string, c: Context): Promise<boolean> => {
  const env = c.get('validatedEnv') // validatedEnv から環境変数を取得

  let secretKey: string
  // リクエストパスに基づいて適切なシークレットキーを選択
  if (c.req.path === '/app/api/auth/login') {
    secretKey = env.LOGINS_TURNSTILE_SECRET_KEY
  } else {
    secretKey = env.TURNSTILE_SECRET_KEY
  }

  // BYPASS_TURNSTILE が true の場合は検証をスキップ
  if (env.BYPASS_TURNSTILE === true) {
    console.log('BYPASS_TURNSTILE is true. Turnstile verification skipped.')
    return true
  }

  const remoteIp = c.req.ip // HonoのContextからIPアドレスを取得

  const formData = new FormData()
  formData.append('secret', secretKey)
  formData.append('response', token)
  if (remoteIp) {
    formData.append('remoteip', remoteIp)
  }

  const MAX_ATTEMPTS = 3
  const BASE_DELAY_MS = 300
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Turnstile verification request failed: ${response.status}`)
      }

      const data: TurnstileVerificationResponse = await response.json()

      if (!data.success) {
        console.error('Turnstile verification failed:', data['error-codes'])
      }

      return data.success
    } catch (error) {
      lastError = error
      console.error(`Error verifying Turnstile token (attempt ${attempt}/${MAX_ATTEMPTS}):`, error)
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** (attempt - 1)))
      }
    }
  }

  try {
    const prisma = getPrismaClient(c)
    const errorMessage =
      lastError instanceof Error ? lastError.message : typeof lastError === 'string' ? lastError : 'Unknown error'
    await prisma.errorLog.create({
      data: {
        statusCode: null,
        path: c.req.path,
        errorMessage: `Turnstile verification permanently failed: ${errorMessage}`,
        stackTrace: lastError instanceof Error ? lastError.stack : undefined,
      },
    })
  } catch (logError) {
    console.error('Failed to persist Turnstile verification error log:', logError)
  }

  return false
}
