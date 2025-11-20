import type { ContactForm, ContactFormRecipient, Prisma, PrismaClient } from '@prisma/client'
import { HTTPException } from 'hono/http-exception'
import type { ContactFormCreateInput, ContactFormRecipientInput, ContactFormUpdateInput } from '../schemas/contactForm'

const attachFormRelations = (form: ContactForm & { recipients: ContactFormRecipient[] }) => ({
  ...form,
  recipients: form.recipients,
})

export const listContactForms = async (prisma: PrismaClient) => {
  const forms = await prisma.contactForm.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      recipients: true,
    },
  })

  return forms.map(attachFormRelations)
}

export const getContactFormById = async (prisma: PrismaClient, id: string) => {
  const form = await prisma.contactForm.findUnique({
    where: { id },
    include: {
      recipients: true,
    },
  })
  if (!form) {
    return null
  }
  return attachFormRelations(form)
}

export const getContactFormBySlug = async (prisma: PrismaClient, slug: string) => {
  const form = await prisma.contactForm.findFirst({
    where: { slug },
    include: {
      recipients: true,
    },
  })
  if (!form) {
    return null
  }
  return attachFormRelations(form)
}

export const createContactForm = async (prisma: PrismaClient, input: ContactFormCreateInput) => {
  const form = await prisma.contactForm.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      successMessage: input.successMessage,
      autoReplyTemplate: input.autoReplyTemplate,
      isActive: input.isActive ?? true,
      replyToFieldSlug: input.replyToFieldSlug,
      recipients: {
        create: input.recipients.map((recipient) => ({
          id: recipient.id,
          email: recipient.email,
          type: recipient.type ?? 'PRIMARY',
        })),
      },
    },
    include: {
      recipients: true,
    },
  })

  return attachFormRelations(form)
}

type DbClient = PrismaClient | Prisma.TransactionClient

const syncRecipients = async (tx: DbClient, formId: string, recipients: ContactFormRecipientInput[]) => {
  const existing = await tx.contactFormRecipient.findMany({ where: { formId } })
  const incomingIds = recipients.filter((recipient) => recipient.id).map((recipient) => recipient.id as string)
  const toDelete = existing.filter((recipient) => !incomingIds.includes(recipient.id)).map((recipient) => recipient.id)

  if (toDelete.length > 0) {
    await tx.contactFormRecipient.deleteMany({
      where: {
        id: { in: toDelete },
      },
    })
  }

  for (const recipient of recipients) {
    const data = {
      email: recipient.email,
      type: recipient.type ?? 'PRIMARY',
    }

    if (recipient.id) {
      await tx.contactFormRecipient.update({
        where: { id: recipient.id },
        data,
      })
    } else {
      await tx.contactFormRecipient.create({
        data: {
          ...data,
          formId,
        },
      })
    }
  }
}

export const updateContactForm = async (prisma: PrismaClient, id: string, input: ContactFormUpdateInput) => {
  const form = await prisma.contactForm.findUnique({
    where: { id },
    include: {
      recipients: true,
    },
  })

  if (!form) {
    throw new HTTPException(404, { message: 'フォームが見つかりません。' })
  }

  await prisma.contactForm.update({
    where: { id },
    data: {
      name: input.name ?? form.name,
      slug: input.slug ?? form.slug,
      description: input.description ?? form.description,
      successMessage: input.successMessage ?? form.successMessage,
      autoReplyTemplate: input.autoReplyTemplate ?? form.autoReplyTemplate,
      sendAutoReply: input.sendAutoReply ?? form.sendAutoReply,
      autoReplySubject: input.autoReplySubject ?? form.autoReplySubject,
      sendAdminNotification: input.sendAdminNotification ?? form.sendAdminNotification,
      adminNotificationSubject: input.adminNotificationSubject ?? form.adminNotificationSubject,
      adminNotificationTemplate: input.adminNotificationTemplate ?? form.adminNotificationTemplate,
      isActive: input.isActive ?? form.isActive,
      replyToFieldSlug: input.replyToFieldSlug ?? form.replyToFieldSlug,
    },
  })

  // notificationEmails を処理
  const newRecipients = (input.notificationEmails ?? '')
    .split('\n')
    .map((email) => email.trim())
    .filter((email) => email.length > 0)
    .map((email) => ({ email, type: 'PRIMARY' as const })) // PRIMARY タイプとして扱う

  await syncRecipients(prisma, id, newRecipients)

  const updated = await prisma.contactForm.findUnique({
    where: { id },
    include: {
      recipients: true,
    },
  })

  if (!updated) {
    throw new HTTPException(404, { message: 'フォームが見つかりません。' })
  }

  return attachFormRelations(updated)
}

export const deleteContactForm = async (prisma: PrismaClient, id: string) => {
  await prisma.contactForm.delete({
    where: { id },
  })
}
