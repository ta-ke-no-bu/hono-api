import type { EmailRetryKind, Prisma, PrismaClient } from '@prisma/client'
import type { Context } from 'hono'
import { Resend } from 'resend'
import { createAuditLog } from '../utils/auditLog'
import { getValidatedEnv } from '../utils/env'
import { getPrismaClient } from '../utils/prisma'

export type AdminNotificationPayload = {
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  html: string
}

export type AutoReplyPayload = {
  from: string
  to: string
  subject: string
  html: string
}

export type EmailRetryPayload = AdminNotificationPayload | AutoReplyPayload

const RETRY_INTERVAL_MINUTES = [5, 15, 60, 180, 360]
const MAX_ATTEMPTS = 5

const isAdminNotificationPayload = (payload: unknown): payload is AdminNotificationPayload => {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const candidate = payload as AdminNotificationPayload
  return (
    typeof candidate.from === 'string' &&
    Array.isArray(candidate.to) &&
    candidate.to.every((item) => typeof item === 'string') &&
    typeof candidate.subject === 'string' &&
    typeof candidate.html === 'string'
  )
}

const isAutoReplyPayload = (payload: unknown): payload is AutoReplyPayload => {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const candidate = payload as AutoReplyPayload
  return (
    typeof candidate.from === 'string' &&
    typeof candidate.to === 'string' &&
    typeof candidate.subject === 'string' &&
    typeof candidate.html === 'string'
  )
}

const computeNextRunAt = (attempts: number) => {
  const index = Math.min(attempts, RETRY_INTERVAL_MINUTES.length - 1)
  const delayMinutes = RETRY_INTERVAL_MINUTES[index]
  const next = new Date()
  next.setMinutes(next.getMinutes() + delayMinutes)
  return next
}

export const enqueueEmailRetry = async (
  prisma: PrismaClient,
  submissionId: string,
  kind: EmailRetryKind,
  payload: EmailRetryPayload,
  error: unknown
) => {
  const errorMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error ?? null)

  const existing = await prisma.emailRetryQueue.findUnique({
    where: { contactSubmissionId_kind: { contactSubmissionId: submissionId, kind } },
  })

  if (existing) {
    await prisma.emailRetryQueue.update({
      where: { contactSubmissionId_kind: { contactSubmissionId: submissionId, kind } },
      data: {
        lastError: errorMessage,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
        nextRunAt: computeNextRunAt(existing.attempts),
      },
    })
    return
  }

  await prisma.emailRetryQueue.create({
    data: {
      contactSubmissionId: submissionId,
      kind,
      payload: payload as Prisma.InputJsonValue,
      lastError: errorMessage,
      nextRunAt: computeNextRunAt(0),
    },
  })
}

export const clearEmailRetry = async (prisma: PrismaClient, submissionId: string, kind: EmailRetryKind) => {
  await prisma.emailRetryQueue.deleteMany({
    where: { contactSubmissionId: submissionId, kind },
  })
}

const computeStatusAfterSuccess = (currentStatus: string, kind: EmailRetryKind, otherPending: boolean) => {
  if (kind === 'ADMIN_NOTIFICATION') {
    if (currentStatus === 'auto_reply_sent' || currentStatus === 'sent') {
      return 'sent'
    }
    if (currentStatus === 'failed' && otherPending) {
      return 'failed'
    }
    if (currentStatus === 'admin_failed' || currentStatus === 'sending') {
      return 'admin_sent'
    }
    return currentStatus
  }

  if (kind === 'AUTO_REPLY') {
    if (otherPending) {
      return currentStatus === 'failed' ? 'failed' : 'admin_failed'
    }
    if (currentStatus === 'admin_sent' || currentStatus === 'sent' || currentStatus === 'failed') {
      return 'sent'
    }
    if (currentStatus === 'sending' || currentStatus === 'auto_reply_sent') {
      return 'auto_reply_sent'
    }
    if (currentStatus === 'failed') {
      return 'admin_sent'
    }
    return currentStatus
  }

  return currentStatus
}

const computeStatusAfterExhausted = (currentStatus: string, kind: EmailRetryKind) => {
  if (kind === 'ADMIN_NOTIFICATION') {
    return 'admin_failed'
  }
  if (kind === 'AUTO_REPLY') {
    return 'failed'
  }
  return currentStatus
}

export const processEmailRetryQueue = async (c: Context, limit = 10) => {
  const prisma = getPrismaClient(c)
  const env = getValidatedEnv(c)
  const resend = new Resend(env.RESEND_API_KEY)

  const now = new Date()
  const pendingEntries = await prisma.emailRetryQueue.findMany({
    where: {
      status: 'PENDING',
      nextRunAt: { lte: now },
    },
    take: limit,
    orderBy: { nextRunAt: 'asc' },
    include: {
      contactSubmission: {
        select: {
          id: true,
          emailStatus: true,
        },
      },
    },
  })

  let successCount = 0
  let failureCount = 0

  for (const entry of pendingEntries) {
    const { contactSubmission, kind, payload } = entry

    try {
      let autoReplyId: string | null = null
      if (kind === 'ADMIN_NOTIFICATION') {
        if (!isAdminNotificationPayload(payload)) {
          throw new Error('Invalid admin notification payload in retry queue')
        }
        const message = payload
        await resend.emails.send({
          from: message.from,
          to: message.to,
          cc: message.cc && message.cc.length > 0 ? message.cc : undefined,
          bcc: message.bcc && message.bcc.length > 0 ? message.bcc : undefined,
          subject: message.subject,
          html: message.html,
        })
      } else {
        if (!isAutoReplyPayload(payload)) {
          throw new Error('Invalid auto reply payload in retry queue')
        }
        const message = payload
        const result = await resend.emails.send({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
        })
        if (result.error) {
          throw result.error
        }
        autoReplyId = result.data?.id ?? null
        if (!autoReplyId) {
          throw new Error('Resend APIからメールIDが返却されませんでした')
        }
      }

      successCount += 1

      const otherPending = await prisma.emailRetryQueue.count({
        where: {
          contactSubmissionId: contactSubmission.id,
          kind: kind === 'ADMIN_NOTIFICATION' ? 'AUTO_REPLY' : 'ADMIN_NOTIFICATION',
          status: 'PENDING',
        },
      })

      await prisma.$transaction([
        prisma.emailRetryQueue.delete({ where: { id: entry.id } }),
        prisma.contactSubmission.update({
          where: { id: contactSubmission.id },
          data: {
            emailStatus: computeStatusAfterSuccess(contactSubmission.emailStatus, kind, otherPending > 0),
            ...(kind === 'AUTO_REPLY' && autoReplyId
              ? {
                  resendEmailId: autoReplyId,
                }
              : {}),
          },
        }),
      ])
    } catch (error) {
      failureCount += 1
      const nextAttempts = entry.attempts + 1
      const exhausted = nextAttempts >= MAX_ATTEMPTS
      const nextRunAt = exhausted ? entry.nextRunAt : computeNextRunAt(nextAttempts)

      await prisma.emailRetryQueue.update({
        where: { id: entry.id },
        data: {
          attempts: nextAttempts,
          lastError:
            error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error ?? null),
          status: exhausted ? 'EXHAUSTED' : 'PENDING',
          nextRunAt,
        },
      })

      if (exhausted) {
        await prisma.contactSubmission.update({
          where: { id: contactSubmission.id },
          data: {
            emailStatus: computeStatusAfterExhausted(contactSubmission.emailStatus, kind),
          },
        })

        try {
          await createAuditLog(prisma, c, 'CONTACT_EMAIL_RETRY_EXHAUSTED', null, {
            submissionId: contactSubmission.id,
            kind,
          })
        } catch (auditError) {
          console.error('Failed to create audit log for exhausted email retry:', auditError)
        }
      }
    }
  }

  return {
    processed: pendingEntries.length,
    successCount,
    failureCount,
  }
}
