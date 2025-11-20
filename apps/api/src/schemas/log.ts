// apps/api/src/schemas/log.ts
import { extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

// ErrorLogデータスキーマ (PrismaのErrorLogモデルに対応)
export const errorLogDataSchema = z
  .object({
    id: z.number().int(),
    createdAt: z.string().datetime(),
    statusCode: z.number().int().nullable(),
    path: z.string().nullable(),
    errorMessage: z.string(),
    stackTrace: z.string().nullable(),
  })
  .openapi('ErrorLogData')

// エラーログ一覧レスポンススキーマ
export const errorLogsResponseSchema = z.array(errorLogDataSchema).openapi('ErrorLogsResponse')
