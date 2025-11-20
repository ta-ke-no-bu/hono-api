import type { Prisma, PrismaClient } from '@prisma/client'
import type { Context } from 'hono'
import { z } from 'zod'
import { getAppSetting, upsertAppSetting } from '../repositories/appSetting'
import { createAuditLog } from '../utils/auditLog'

export const mailSettingSchema = z.object({
  adminEmail: z.string().email('無効な管理者メールアドレスです'),
  fromEmail: z.string().email('無効な送信元メールアドレスです'),
})

type MailSettingInput = z.infer<typeof mailSettingSchema>

const SETTING_KEYS = {
  adminEmail: 'ADMIN_EMAIL',
  fromEmail: 'FROM_EMAIL',
} as const

type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

const coerceEmail = (value?: string | null) => {
  if (!value) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const maskEmail = (email: string) => {
  return email.replace(/(.{2}).+(@.+)/, '$1****$2')
}

const extractEmailValue = (value: Prisma.JsonValue | null | undefined) => {
  if (typeof value === 'string') {
    return coerceEmail(value)
  }
  return undefined
}

export class MailSettingNotConfiguredError extends Error {
  constructor(public missingKeys: SettingKey[]) {
    super('メール設定が未登録です')
    this.name = 'MailSettingNotConfiguredError'
  }
}

export const getMailSettings = async (prisma: PrismaClient) => {
  const [adminSetting, fromSetting] = await Promise.all([
    getAppSetting(SETTING_KEYS.adminEmail, prisma),
    getAppSetting(SETTING_KEYS.fromEmail, prisma),
  ])

  const adminEmail = extractEmailValue(adminSetting?.value)
  const fromEmail = extractEmailValue(fromSetting?.value)

  const missing: SettingKey[] = []
  if (!adminEmail) {
    missing.push(SETTING_KEYS.adminEmail)
  }
  if (!fromEmail) {
    missing.push(SETTING_KEYS.fromEmail)
  }

  if (missing.length > 0) {
    throw new MailSettingNotConfiguredError(missing)
  }

  return { adminEmail, fromEmail }
}

export const updateMailSettings = async (prisma: PrismaClient, c: Context, input: MailSettingInput) => {
  const parsed = mailSettingSchema.parse(input)
  const adminEmail = parsed.adminEmail.trim()
  const fromEmail = parsed.fromEmail.trim()
  const user = c.get('user')

  await upsertAppSetting(SETTING_KEYS.adminEmail, adminEmail, prisma, user?.id)
  await upsertAppSetting(SETTING_KEYS.fromEmail, fromEmail, prisma, user?.id)

  await createAuditLog(prisma, c, 'MAIL_SETTINGS_UPDATED', user?.id, {
    adminEmailMasked: maskEmail(adminEmail),
    fromEmailMasked: maskEmail(fromEmail),
  })

  return { adminEmail, fromEmail }
}
