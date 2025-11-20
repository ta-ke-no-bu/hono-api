import type { PrismaClient } from '@prisma/client'
import type { Context } from 'hono'
import { encrypt } from './crypto' // encrypt関数をインポート

export const createAuditLog = async (
  prisma: PrismaClient,
  c: Context,
  eventType: string,
  userId?: number,
  details?: Record<string, unknown>
) => {
  const ipAddress = c.req.header('CF-Connecting-IP') || c.req.ip || 'unknown'
  const userAgent = c.req.header('User-Agent') || 'unknown'
  const env = c.get('validatedEnv') // 環境変数を取得

  let encryptedDetails: string | undefined

  if (details) {
    try {
      const detailsString = JSON.stringify(details)
      encryptedDetails = encrypt(detailsString, env.AUDIT_LOG_ENCRYPTION_KEY)
    } catch (error) {
      console.error('監査ログの詳細暗号化に失敗しました:', error)
      // 暗号化失敗時は、暗号化せずに保存するか、エラーをスローするか、undefinedにするか検討
      // ここでは、暗号化せずに保存する（ただし、本番環境ではセキュリティリスク）か、undefinedにする
      encryptedDetails = undefined // あるいは JSON.stringify(details);
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        eventType,
        ipAddress,
        userAgent,
        details: encryptedDetails, // 暗号化された詳細を保存
      },
    })
  } catch (error) {
    console.error('監査ログの書き込みに失敗しました:', error)
  }
}
