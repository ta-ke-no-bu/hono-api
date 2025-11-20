import type { Context, Next } from 'hono'
import { type JwtPayload, verifyToken } from '../services/auth'

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload
  }
}

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthorized: No token provided' }, 401)
  }

  const token = authHeader.split(' ')[1]
  const decoded = await verifyToken(token, c)

  if (!decoded) {
    return c.json({ message: 'Unauthorized: Invalid token' }, 401)
  }

  c.set('user', decoded) // デコードされたユーザー情報をコンテキストに保存
  await next()
}
