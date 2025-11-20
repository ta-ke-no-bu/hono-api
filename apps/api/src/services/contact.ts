import { type ContactForm, Prisma, type PrismaClient } from '@prisma/client'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Resend } from 'resend'
import xss from 'xss'
import { CONTACT_OPTION_LABELS, getContactFormDefinition } from '../config/contactFormDefinitions'
import type { ContactSubmissionInput } from '../schemas/contact'
import { createAuditLog } from '../utils/auditLog'
import { getValidatedEnv } from '../utils/env'
import { verifyTurnstileToken } from '../utils/turnstile'
import {
  type AdminNotificationPayload,
  type AutoReplyPayload,
  clearEmailRetry,
  enqueueEmailRetry,
} from './emailRetryQueue'
import { MailSettingNotConfiguredError, getMailSettings } from './settings'

const sanitizeString = (value: unknown): string => xss(String(value ?? '').trim())

const formatHtmlValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '未入力'
  }
  if (value === null || value === undefined || value === '') {
    return '未入力'
  }
  return String(value).replace(/\n/g, '<br />')
}

const renderTemplate = (template: string, values: Record<string, unknown>, extra: Record<string, string>) => {
  return template.replace(/{{\s*([\w-]+)\s*}}/g, (_, key: string) => {
    if (key in extra) {
      return extra[key]
    }
    const value = values[key]
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    if (value === undefined || value === null) {
      return ''
    }
    return String(value)
  })
}

const buildAdminEmailHtml = (
  form: ContactForm,
  values: Record<string, unknown>,
  submissionId: string,
  resolveLabel: (slug: string) => string
) => {
  const rows = Object.entries(values)
    .map(([key, value]) => {
      const resolvedLabel = resolveLabel(key)
      const safeKey = sanitizeString(resolvedLabel)
      return `<p><strong>${safeKey}</strong><br />${formatHtmlValue(value)}</p>`
    })
    .join('\n')

  return `
    <div>
      <p>${form.name} から新しいお問い合わせがありました。</p>
      <p><strong>お問い合わせID:</strong> ${submissionId}</p>
      <hr />
      ${rows}
    </div>
  `
}

const buildAutoReplyHtml = (
  form: ContactForm,
  values: Record<string, unknown>,
  submissionId: string,
  resolveLabel: (slug: string) => string
) => {
  const rows = Object.entries(values)
    .map(([key, value]) => {
      const safeKey = sanitizeString(resolveLabel(key))
      return `<p><strong>${safeKey}</strong><br />${formatHtmlValue(value)}</p>`
    })
    .join('\n')

  return `
    <div>
      <p>この度はお問い合わせいただきありがとうございます。</p>
      <p>以下の内容で受け付けいたしました。</p>
      <hr />
      ${rows}
      <hr />
      <p>お問い合わせID: ${submissionId}</p>
    </div>
  `
}

const extractString = (values: Record<string, unknown>, key: string | null | undefined): string | null => {
  if (!key) return null
  const value = values[key]
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : null
  }
  if (value === undefined || value === null) {
    return null
  }
  return String(value)
}

const buildTemplateValues = (formSlug: string, values: Record<string, unknown>) => {
  const result: Record<string, unknown> = {}
  const optionMap = CONTACT_OPTION_LABELS[formSlug]

  for (const [key, rawValue] of Object.entries(values)) {
    if (!optionMap || !optionMap[key]) {
      result[key] = rawValue
      continue
    }

    if (Array.isArray(rawValue)) {
      result[key] = rawValue.map((item) => {
        if (typeof item !== 'string') {
          return item
        }
        return optionMap[key][item] ?? item
      })
      continue
    }

    if (typeof rawValue === 'string') {
      result[key] = optionMap[key][rawValue] ?? rawValue
      continue
    }

    result[key] = rawValue
  }

  return result
}

export const submitContactForm = async (input: ContactSubmissionInput, prisma: PrismaClient, c: Context) => {
  const env = getValidatedEnv(c)

  let mailSettings: Awaited<ReturnType<typeof getMailSettings>>
  try {
    mailSettings = await getMailSettings(prisma)
  } catch (error) {
    if (error instanceof MailSettingNotConfiguredError) {
      throw new HTTPException(500, {
        message: 'メール通知設定が未登録です。管理画面から設定を完了してください。',
      })
    }
    throw error
  }

  const form = await prisma.contactForm.findFirst({
    where: {
      slug: input.formSlug,
      isActive: true,
    },
    include: {
      recipients: true,
    },
  })

  if (!form) {
    throw new HTTPException(404, { message: '指定されたフォームが見つかりません。' })
  }

  if (env.NODE_ENV !== 'test' && form.turnstileEnabled) {
    const shouldBypassTurnstile = env.NODE_ENV === 'development' && Boolean(env.BYPASS_TURNSTILE)
    if (!shouldBypassTurnstile) {
      const isValidTurnstile = await verifyTurnstileToken(input.turnstileToken, c)
      if (!isValidTurnstile) {
        throw new HTTPException(403, { message: 'Turnstile検証に失敗しました。時間をおいて再試行してください。' })
      }
    }
  }

  const sanitizedValues: Record<string, unknown> = {}
  for (const [key, rawValue] of Object.entries(input.values ?? {})) {
    if (Array.isArray(rawValue)) {
      const cleaned = rawValue.map((value) => sanitizeString(value)).filter((value) => value.length > 0)
      sanitizedValues[key] = cleaned.length > 0 ? cleaned : []
    } else if (rawValue === null || rawValue === undefined || rawValue === '') {
      sanitizedValues[key] = null
    } else if (typeof rawValue === 'object') {
      sanitizedValues[key] = sanitizeString(JSON.stringify(rawValue))
    } else {
      sanitizedValues[key] = sanitizeString(rawValue)
    }
  }

  if (form.replyToFieldSlug && !(form.replyToFieldSlug in sanitizedValues)) {
    throw new HTTPException(422, {
      message: `返信先フィールド ${form.replyToFieldSlug} が送信データに含まれていません。`,
    })
  }

  const displayName =
    extractString(sanitizedValues, 'name') ??
    extractString(sanitizedValues, 'fullname') ??
    extractString(sanitizedValues, 'company')
  const displayEmail = extractString(sanitizedValues, form.replyToFieldSlug ?? 'email')
  const displaySubject = extractString(sanitizedValues, 'subject')
  const definition = getContactFormDefinition(form.slug)
  const resolveFieldLabel = (slug: string) => {
    const field = definition?.fields.find((field) => field.slug === slug)
    return field?.label ?? slug
  }

  const submission = await prisma.contactSubmission.create({
    data: {
      formId: form.id,
      payload: sanitizedValues as Prisma.JsonObject,
      submittedIp: c.req.header('CF-Connecting-IP') ?? c.req.ip ?? undefined,
      userAgent: c.req.header('User-Agent') ?? undefined,
      displayName: displayName ?? undefined,
      displayEmail: displayEmail ?? undefined,
      displaySubject: displaySubject ?? undefined,
      legacyName: extractString(sanitizedValues, 'name') ?? undefined,
      legacyCompany: extractString(sanitizedValues, 'company') ?? undefined,
      legacyEmail: extractString(sanitizedValues, 'email') ?? undefined,
      legacyTelephone: extractString(sanitizedValues, 'telephone') ?? undefined,
      legacyMessage: extractString(sanitizedValues, 'message') ?? undefined,
    },
  })

  // Audit log for contact submission
  const auditDetails = {
    formName: form.name,
    formSlug: form.slug,
    submissionId: submission.id,
    displayName,
    displayEmail,
    // Do not include payload to avoid personal data in audit logs
  }
  await createAuditLog(prisma, c, 'contact_submit', null, auditDetails)

  const adminRecipients = form.recipients.filter((r) => r.type === 'PRIMARY').map((r) => r.email)
  const ccRecipients = form.recipients.filter((r) => r.type === 'CC').map((r) => r.email)
  const bccRecipients = form.recipients.filter((r) => r.type === 'BCC').map((r) => r.email)

  const primaryRecipients = adminRecipients.length > 0 ? adminRecipients : [mailSettings.adminEmail]

  const resend = new Resend(env.RESEND_API_KEY)
  const adminSubject = displaySubject
    ? `【${form.name}】${displaySubject}`
    : `【${form.name}】新しいお問い合わせが届きました`

  type MailSendState = 'pending' | 'sent' | 'failed' | 'skipped'

  const templateValues = buildTemplateValues(form.slug, sanitizedValues)

  const runWithRetry = async <T>(label: string, operation: () => Promise<T>): Promise<T> => {
    const maxAttempts = 3
    const baseDelayMs = 500
    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (attempt < maxAttempts) {
          console.warn(`[contact] retrying ${label} (${attempt}/${maxAttempts})`, error)
          await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)))
          continue
        }
        break
      }
    }
    if (lastError === undefined) {
      throw new Error(`${label} failed without error detail`)
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  const recordEmailFailure = async (kind: 'admin_notification' | 'auto_reply', error: unknown) => {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error ?? null)
    console.error(`[contact] ${kind} email failed`, error)
    try {
      await prisma.errorLog.create({
        data: {
          statusCode: null,
          path: '/app/api/contact',
          errorMessage: `[${kind}] ${message}`,
          stackTrace: error instanceof Error ? error.stack : undefined,
        },
      })
    } catch (logError) {
      console.error('Failed to record contact email failure:', logError)
    }
    try {
      await createAuditLog(prisma, c, 'CONTACT_EMAIL_FAILURE', null, {
        kind,
        formSlug: form.slug,
        submissionId: submission.id,
        adminRecipients,
        ccRecipients,
        bccRecipients,
        displayEmail,
      })
    } catch (auditError) {
      console.error('Failed to record contact email failure audit log:', auditError)
    }
  }

  let adminStatus: MailSendState = form.sendAdminNotification ? 'pending' : 'skipped'
  let autoReplyStatus: MailSendState = form.sendAutoReply ? 'pending' : 'skipped'
  let autoReplySkippedDueToMissingAddress = false
  let autoReplyResendId: string | null = null

  if (form.sendAdminNotification) {
    let adminPayload: AdminNotificationPayload | null = null
    try {
      const adminNotificationSubject = form.adminNotificationSubject
        ? renderTemplate(form.adminNotificationSubject, templateValues, {
            formName: form.name,
            contactId: submission.id,
          })
        : adminSubject

      const adminNotificationHtml = form.adminNotificationTemplate
        ? renderTemplate(form.adminNotificationTemplate, templateValues, {
            formName: form.name,
            contactId: submission.id,
          })
        : buildAdminEmailHtml(form, templateValues, submission.id, resolveFieldLabel)

      const payload: AdminNotificationPayload = {
        from: mailSettings.fromEmail,
        to: primaryRecipients,
        cc: ccRecipients.length ? ccRecipients : undefined,
        bcc: bccRecipients.length ? bccRecipients : undefined,
        subject: adminNotificationSubject,
        html: adminNotificationHtml,
      }

      adminPayload = payload

      await runWithRetry('admin_notification', async () => {
        const result = await resend.emails.send(payload)

        if (result.error) {
          throw result.error
        }

        if (!result.data?.id) {
          throw new Error('Resend APIから管理者通知のメールIDが返却されませんでした')
        }

        return result
      })

      adminStatus = 'sent'
      await clearEmailRetry(prisma, submission.id, 'ADMIN_NOTIFICATION')
    } catch (error) {
      adminStatus = 'failed'
      await recordEmailFailure('admin_notification', error)
      if (adminPayload) {
        await enqueueEmailRetry(prisma, submission.id, 'ADMIN_NOTIFICATION', adminPayload, error)
      }
    }
  }

  if (form.sendAutoReply) {
    if (displayEmail) {
      let autoPayload: AutoReplyPayload | null = null
      try {
        const autoReplySubject = form.autoReplySubject
          ? renderTemplate(form.autoReplySubject, templateValues, {
              formName: form.name,
              contactId: submission.id,
            })
          : `【${form.name}】お問い合わせを受け付けました`

        const template = form.autoReplyTemplate
          ? renderTemplate(form.autoReplyTemplate, templateValues, {
              formName: form.name,
              contactId: submission.id,
            })
          : buildAutoReplyHtml(form, templateValues, submission.id, resolveFieldLabel)

        const payload: AutoReplyPayload = {
          from: mailSettings.fromEmail,
          to: displayEmail,
          subject: autoReplySubject,
          html: template,
        }

        autoPayload = payload

        const replyResult = await runWithRetry('auto_reply', async () => {
          const result = await resend.emails.send(payload)

          if (result.error) {
            throw result.error
          }

          if (!result.data?.id) {
            throw new Error('Resend APIからメールIDが返却されませんでした')
          }

          return result
        })

        autoReplyStatus = 'sent'
        autoReplyResendId = replyResult.data.id
        await clearEmailRetry(prisma, submission.id, 'AUTO_REPLY')
      } catch (error) {
        autoReplyStatus = 'failed'
        await recordEmailFailure('auto_reply', error)
        if (autoPayload) {
          await enqueueEmailRetry(prisma, submission.id, 'AUTO_REPLY', autoPayload, error)
        }
      }
    } else {
      autoReplyStatus = 'skipped'
      autoReplySkippedDueToMissingAddress = true
      console.warn('返信先メールアドレスを取得できないため自動返信メールをスキップしました', {
        formId: form.id,
        replyToFieldSlug: form.replyToFieldSlug,
      })
    }
  }

  let nextEmailStatus = submission.emailStatus

  if (autoReplyStatus === 'failed') {
    nextEmailStatus = 'failed'
  } else if (adminStatus === 'failed') {
    nextEmailStatus = 'admin_failed'
  } else if (autoReplySkippedDueToMissingAddress) {
    nextEmailStatus = 'missing_reply_to'
  } else if (autoReplyStatus === 'sent' && adminStatus === 'sent') {
    nextEmailStatus = 'sent'
  } else if (autoReplyStatus === 'sent') {
    nextEmailStatus = 'auto_reply_sent'
  } else if (adminStatus === 'sent') {
    nextEmailStatus = 'admin_sent'
  } else if (adminStatus === 'skipped' && autoReplyStatus === 'skipped') {
    nextEmailStatus = 'skipped'
  } else {
    nextEmailStatus = 'sending'
  }

  const updatePayload: Prisma.ContactSubmissionUpdateInput = {
    emailStatus: nextEmailStatus,
  }

  if (autoReplyResendId) {
    updatePayload.resendEmailId = autoReplyResendId
  }

  try {
    if (
      nextEmailStatus !== submission.emailStatus ||
      (autoReplyResendId && submission.resendEmailId !== autoReplyResendId)
    ) {
      await prisma.contactSubmission.update({
        where: { id: submission.id },
        data: updatePayload,
      })
      submission.emailStatus = nextEmailStatus
    }
  } catch (updateError) {
    console.error('メールステータス更新に失敗しました:', updateError)
  }

  return {
    submission,
    successMessage: form.successMessage ?? definition?.successMessage ?? null,
  }
}

type ListContactSubmissionsOptions = {
  limit?: number
  offset?: number
}

export const listContactSubmissions = async (prisma: PrismaClient, options: ListContactSubmissionsOptions = {}) => {
  const { limit, offset } = options

  const limitClause = typeof limit === 'number' ? Prisma.sql`LIMIT ${limit}` : Prisma.empty
  const offsetClause = typeof offset === 'number' ? Prisma.sql`OFFSET ${offset}` : Prisma.empty

  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      formId: string
      formName: string
      formSlug: string
      displayName: string | null
      displayEmail: string | null
      displaySubject: string | null
      emailStatus: string
      createdAt: string
      updatedAt: string
    }>
  >(Prisma.sql`
    SELECT
      c.id,
      c.formId,
      f.name AS formName,
      f.slug AS formSlug,
      c.displayName,
      c.displayEmail,
      c.displaySubject,
      c.emailStatus,
      c.createdAt,
      c.updatedAt
    FROM Contact AS c
    INNER JOIN ContactForm AS f ON f.id = c.formId
    ORDER BY c.createdAt DESC
    ${limitClause}
    ${offsetClause}
  `)

  return rows.map((row) => ({
    id: row.id,
    formId: row.formId,
    formName: row.formName,
    formSlug: row.formSlug,
    displayName: row.displayName,
    displayEmail: row.displayEmail,
    displaySubject: row.displaySubject,
    emailStatus: row.emailStatus,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }))
}

export const getContactSubmissionDetail = async (prisma: PrismaClient, id: string) => {
  const submission = await prisma.contactSubmission.findUnique({
    where: { id },
    include: {
      form: true,
    },
  })

  if (!submission) {
    return null
  }

  const payload = submission.payload as Prisma.JsonObject

  return {
    id: submission.id,
    formId: submission.formId,
    formName: submission.form.name,
    formSlug: submission.form.slug,
    displayName: submission.displayName,
    displayEmail: submission.displayEmail,
    displaySubject: submission.displaySubject,
    emailStatus: submission.emailStatus,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    payload: payload as Record<string, unknown>,
    form: {
      id: submission.form.id,
      name: submission.form.name,
      slug: submission.form.slug,
    },
  }
}

export const updateContactSubmissionStatus = async (prisma: PrismaClient, id: string, emailStatus: string) => {
  const updated = await prisma.contactSubmission.update({
    where: { id },
    data: { emailStatus },
    include: {
      form: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  return {
    id: updated.id,
    formId: updated.formId,
    formName: updated.form.name,
    formSlug: updated.form.slug,
    displayName: updated.displayName,
    displayEmail: updated.displayEmail,
    displaySubject: updated.displaySubject,
    emailStatus: updated.emailStatus,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
}
