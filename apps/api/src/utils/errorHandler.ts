import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { getValidatedEnv } from './env'

type CFExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void
}

// 機密情報をサニタイズするヘルパー関数
const sanitizeError = (error: Error, isProduction: boolean) => {
  let message = error.message
  let stack = error.stack

  if (isProduction) {
    // 本番環境ではスタックトレースを完全に除去
    stack = undefined

    // エラーメッセージから特定のパターンをマスキング
    message = message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_MASKED]') // メールアドレス
    message = message.replace(/\b(password|secret|token|key)=[^&\s]+\b/gi, '$1=[MASKED]') // パスワード、シークレットなど
    // 必要に応じて他の機密情報パターンを追加
  }

  return { message, stack }
}

export const errorHandler = async (err: Error, c: Context) => {
  const env = getValidatedEnv(c)
  const isProduction = env.NODE_ENV === 'production'

  const { message: sanitizedMessage, stack: sanitizedStack } = sanitizeError(err, isProduction)

  console.error('捕捉されたエラー:', sanitizedMessage, isProduction ? '' : sanitizedStack) // 開発環境のみスタックトレースを出力

  // --- DBへのエラーロギング処理 ---
  const logTask = async () => {
    try {
      const prisma = ((): unknown => {
        try {
          return c.get('prisma')
        } catch {
          return undefined
        }
      })()

      if (!prisma) {
        return
      }

      await (prisma as { errorLog: { create: (args: unknown) => Promise<unknown> } }).errorLog.create({
        data: {
          statusCode: err instanceof HTTPException ? err.status : 500,
          path: c.req.path,
          errorMessage: sanitizedMessage, // サニタイズされたメッセージを使用
          stackTrace: sanitizedStack, // サニタイズされたスタックトレースを使用
        },
      })
    } catch (dbError) {
      console.error('DBへのエラーログ書き込みに失敗しました:', dbError)
    }
  }

  let handledByExecutionCtx = false
  try {
    const executionCtx = (c as unknown as { executionCtx?: CFExecutionContext }).executionCtx
    if (executionCtx && typeof executionCtx.waitUntil === 'function') {
      executionCtx.waitUntil(logTask())
      handledByExecutionCtx = true
    }
  } catch (ctxError) {
    console.warn('ExecutionContextの取得に失敗しました:', ctxError)
  }

  if (!handledByExecutionCtx) {
    await logTask()
  }
  // --- ロギング処理ここまで ---

  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  const responseMessage = isProduction ? 'サーバーでエラーが発生しました' : sanitizedMessage
  const response = isProduction
    ? { message: responseMessage }
    : { message: responseMessage, error: sanitizedMessage, stack: sanitizedStack }

  return c.json(response, 500)
}
