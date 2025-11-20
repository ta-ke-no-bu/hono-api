import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

// ユーザーデータスキーマ (PrismaのUserモデルに対応)
export const userDataSchema = z
  .object({
    id: z.number().int(),
    email: z.string().email(),
    name: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('UserData')

// ユーザー一覧レスポンススキーマ
export const usersResponseSchema = z.array(userDataSchema).openapi('UsersResponse')

// ユーザー更新リクエストスキーマ
export const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().nullable().optional(),
  })
  .openapi('UpdateUser')
