import { createHmac, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { getValidatedEnv } from '../utils/env'
import { getPrismaClient } from '../utils/prisma'

// ResendのWebhookイベントの基本スキーマ
const resendEventSchema = z.object({
  type: z.string(),
  created_at: z.string(),
  data: z.object({
    email_id: z.string(),
    // 他にも多くのフィールドが存在するが、ここではemail_idのみを必須とする
  }),
})

const webhooks = new Hono()

const verifyResendSignature = (payload: string, secret: string, providedSignature: string | undefined) => {
  if (!providedSignature) {
    return false
  }
  const normalizedSignature = providedSignature.trim().toLowerCase()
  if (!/^[0-9a-f]+$/.test(normalizedSignature) || normalizedSignature.length % 2 !== 0) {
    return false
  }
  const providedBuffer = Buffer.from(normalizedSignature, 'hex')

  const expectedBuffer = createHmac('sha256', secret).update(payload, 'utf8').digest()
  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

// ResendからのWebhookを受け取るエンドポイント
webhooks.post('/resend', async (c) => {
  const env = getValidatedEnv(c)
  const rawBody = await c.req.text()

  if (!verifyResendSignature(rawBody, env.RESEND_WEBHOOK_SECRET, c.req.header('Resend-Signature'))) {
    return c.json({ message: 'Invalid signature' }, 403)
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch (error) {
    console.error('Failed to parse Resend webhook payload:', error)
    return c.json({ message: 'Invalid JSON payload' }, 400)
  }

  const parsedEvent = resendEventSchema.safeParse(parsedBody)
  if (!parsedEvent.success) {
    console.error('Resend webhook payload validation failed:', parsedEvent.error.flatten())
    return c.json({ message: 'Invalid payload' }, 400)
  }

  const event = parsedEvent.data
  const prisma = getPrismaClient(c)

  console.log(`Received Resend webhook event: ${event.type}`)

  const { type, data } = event
  const { email_id } = data

  // email_idを使って、どのメールに関するイベントかを特定する必要がある
  // しかし、現在のDBスキーマではResendのemail_idを保存していないため、
  // どの問い合わせに対応するイベントか紐付けができない。
  // これは次のステップで修正します。

  let newStatus: string | null = null

  switch (type) {
    case 'email.delivered':
      newStatus = 'delivered'
      break
    case 'email.bounced':
      newStatus = 'bounced'
      break
    case 'email.complained':
      newStatus = 'complained'
      break
    case 'email.failed':
      newStatus = 'failed'
      break
    default:
      // 未知のイベントタイプは無視
      console.log(`Unhandled event type: ${type}`)
      return c.json({ message: 'Event type unhandled' })
  }

  // DBを更新するロジック
  if (newStatus) {
    try {
      await prisma.contactSubmission.update({
        where: { resendEmailId: email_id },
        data: { emailStatus: newStatus },
      })
      console.log(`Updated contact status to ${newStatus} for email_id: ${email_id}`)
    } catch (error) {
      console.error('Failed to update contact status:', error)
      // resendEmailIdが見つからない場合など
      return c.json({ message: 'Database update failed' }, 500)
    }
  }

  return c.json({ message: 'Webhook received' })
})

export default webhooks
