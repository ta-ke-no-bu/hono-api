import type { PrismaClient } from '@prisma/client'

export const getAuditLogs = async (prisma: PrismaClient, page = 1, limit = 10) => {
  const skip = (page - 1) * limit
  const logs = await prisma.auditLog.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    skip,
    take: limit,
  })
  const total = await prisma.auditLog.count()
  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}
