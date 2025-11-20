import type { Prisma, PrismaClient } from '@prisma/client'

export const getAppSetting = async (key: string, prisma: PrismaClient) => {
  return await prisma.appSetting.findUnique({
    where: { key },
  })
}

export const upsertAppSetting = async (
  key: string,
  value: Prisma.JsonValue,
  prisma: PrismaClient,
  updatedByUserId?: number
) => {
  return await prisma.appSetting.upsert({
    where: { key },
    update: {
      value,
      updatedByUserId,
    },
    create: {
      key,
      value,
      updatedByUserId,
    },
  })
}
