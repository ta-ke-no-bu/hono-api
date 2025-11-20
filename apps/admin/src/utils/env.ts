import { z } from 'zod';

// 環境変数スキーマを定義
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ADMIN_BASE_URL: z.string().url().optional().or(z.literal('')), // 空文字列またはURLを許可
  ADMIN_PORT: z.coerce.number().int().positive().default(5173), // 強制変換とデフォルト値を使用
  ADMIN_API_PROXY_URL: z.string().url().optional().or(z.literal('')), // 空文字列またはURLを許可
  WEB_BASE_URL: z.string().url().optional().or(z.literal('')), // 空文字列またはURLを許可
  WEB_BASE_PATH: z.string().default('/'),
});

// 環境変数をパース
const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  console.error('❌ 無効な環境変数:', parsedEnv.error.flatten().fieldErrors);
  throw new Error('無効な環境変数');
}

export const env = parsedEnv.data;
