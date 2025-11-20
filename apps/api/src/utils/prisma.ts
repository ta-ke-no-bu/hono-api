import { PrismaD1 } from '@prisma/adapter-d1'
import type { Context, Next } from 'hono'

// HonoのContextの型定義を拡張 (wrangler.tomlのbindingに合わせる)
type Bindings = {
  hono_db: D1Database | undefined
  prisma?: PrismaClient
}

type PrismaClient = import('@prisma/client').PrismaClient
type PrismaCtor = new (options?: Prisma.PrismaClientOptions) => PrismaClient

let prismaCtorPromise: Promise<PrismaCtor> | null = null

const loadPrismaCtor = (bindings: Bindings): Promise<PrismaCtor> => {
  if (!prismaCtorPromise) {
    prismaCtorPromise = import('@prisma/client').then((module) => module.PrismaClient as unknown as PrismaCtor)
  }
  return prismaCtorPromise
}

// PrismaClientを初期化し、HonoのContextにバインドするミドルウェア
export const prismaMiddleware = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const bindings = {
    hono_db: c.env.hono_db,
    prisma: c.env.prisma,
  }

  // テスト環境でPrismaClientが既にenvにバインドされているか確認
  if (bindings.prisma) {
    c.set('prisma', bindings.prisma)
    await next()
    return
  }

  const PrismaClientCtor = await loadPrismaCtor(bindings)

  let prisma: PrismaClient
  if (bindings.hono_db) {
    const adapter = new PrismaD1(bindings.hono_db)
    prisma = new PrismaClientCtor({ adapter })
  } else {
    prisma = new PrismaClientCtor()
  }

  c.set('prisma', prisma)
  try {
    await next()
  } finally {
    if (!bindings.hono_db) {
      await prisma.$disconnect()
    }
  }
}

// ContextからPrismaClientを取得するためのヘルパー関数
export const getPrismaClient = (c: Context): PrismaClient => {
  const client = c.get('prisma') as PrismaClient | undefined
  if (!client) {
    throw new Error('PrismaClient is not available in the context. Ensure prismaMiddleware is applied.')
  }
  return client
}
