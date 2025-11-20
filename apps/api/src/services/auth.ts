import type { PrismaClient } from '@prisma/client'
import type { User } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import type { Context } from 'hono'
import { SignJWT, jwtVerify } from 'jose'
import { createAuditLog } from '../utils/auditLog' // AuditLogヘルパーをインポート

// JWTのペイロードの型定義
export type JwtPayload = {
  userId: number
  email: string
}

export type LoginError = {
  type: 'InvalidCredentials' | 'AccountLocked'
  message: string
}

export type LoginResult = { user: User; token: string } | LoginError

const encoder = new TextEncoder()
const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const registerUser = async (
  email: string,
  password: string,
  prisma: PrismaClient,
  name?: string | null,
  c?: Context
) => {
  const normalizedEmail = normalizeEmail(email)
  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      name,
    },
  })

  if (c) {
    await createAuditLog(prisma, c, 'USER_REGISTER', user.id, { email: user.email })
  }

  return user
}

const getSecretKey = (env: { JWT_SECRET: string }) => {
  const secret = env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables')
  }
  return encoder.encode(secret)
}

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 30

export const loginUser = async (
  email: string,
  password: string,
  prisma: PrismaClient,
  c: Context
): Promise<LoginResult> => {
  const normalizedEmail = normalizeEmail(email)
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

  if (!user) {
    await createAuditLog(prisma, c, 'LOGIN_FAILED', undefined, { email: normalizedEmail, reason: 'User not found' })
    return { type: 'InvalidCredentials', message: 'ユーザー名またはパスワードが正しくありません。' }
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    await createAuditLog(prisma, c, 'LOGIN_FAILED', user.id, { email: normalizedEmail, reason: 'Account locked' })
    const remainingLockTime = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000))
    return {
      type: 'AccountLocked',
      message: `アカウントはロックされています。${remainingLockTime}分後に再度お試しください。`,
    }
  }

  const isValidPassword = await bcrypt.compare(password, user.password)

  if (!isValidPassword) {
    const newFailedAttempts = user.failedLoginAttempts + 1
    let newLockUntil: Date | null = null

    if (newFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
      newLockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
      await createAuditLog(prisma, c, 'ACCOUNT_LOCKED', user.id, {
        email: normalizedEmail,
        attempts: newFailedAttempts,
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newFailedAttempts,
        lockUntil: newLockUntil,
      },
    })

    await createAuditLog(prisma, c, 'LOGIN_FAILED', user.id, {
      email: normalizedEmail,
      reason: 'Invalid password',
      attempts: newFailedAttempts,
    })
    return { type: 'InvalidCredentials', message: 'ユーザー名またはパスワードが正しくありません。' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
    },
  })

  const token = await generateToken({ userId: user.id, email: user.email }, c)
  await createAuditLog(prisma, c, 'LOGIN_SUCCESS', user.id, { email: user.email })
  return { user, token }
}

export const generateToken = async (payload: JwtPayload, c: Context): Promise<string> => {
  const secretKey = getSecretKey(c.get('validatedEnv'))
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setSubject(String(payload.userId))
    .setExpirationTime('1h')
    .sign(secretKey)
}

export const verifyToken = async (token: string, c: Context): Promise<JwtPayload | null> => {
  try {
    const secretKey = getSecretKey(c.get('validatedEnv'))
    const { payload } = await jwtVerify<JwtPayload>(token, secretKey)
    return payload as JwtPayload
  } catch (error) {
    return null
  }
}
