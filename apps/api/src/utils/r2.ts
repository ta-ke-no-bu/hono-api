import '../polyfills/dom-parser'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export type PresignedUpload = {
  uploadUrl: string
  objectUrl: string
  key: string
  expiresIn: number
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_ALLOWED_CONTENT_TYPES = ['application/pdf']
const DEFAULT_OBJECT_PREFIX = 'posts'

const CONTENT_TYPE_EXTENSION_MAP = new Map<string, string>([
  ['application/pdf', '.pdf'],
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/svg+xml', '.svg'],
])

type PresignedUploadParams = {
  fileName: string
  contentType: string
  contentLength: number
  allowedContentTypes?: string[]
  maxFileSize?: number
  objectKeyPrefix?: string
  fallbackExtension?: string
}

const createS3Client = (env: Record<string, string | undefined>) => {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY
  const secretAccessKey = env.CLOUDFLARE_R2_SECRET_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new HTTPException(500, { message: 'ファイルアップロード設定が不足しています。' })
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

const validateFileRequest = (
  contentType: string | undefined,
  contentLength: number | undefined,
  allowedContentTypes: Set<string>,
  maxFileSize: number
) => {
  if (!contentType || !allowedContentTypes.has(contentType)) {
    throw new HTTPException(400, { message: '許可されていないファイル形式です。' })
  }

  if (!contentLength || Number.isNaN(contentLength) || contentLength <= 0) {
    throw new HTTPException(400, { message: 'ファイルサイズが不正です。' })
  }

  if (contentLength > maxFileSize) {
    throw new HTTPException(400, {
      message: `ファイルサイズが大きすぎます（最大${Math.floor(maxFileSize / (1024 * 1024))}MB）。`,
    })
  }
}

const sanitizeFileName = (originalName: string, fallbackExtension: string) => {
  const sanitized = originalName.trim().replace(/[^a-zA-Z0-9_.-]/g, '_')
  if (!sanitized) {
    return `file${fallbackExtension}`
  }
  if (!sanitized.includes('.') && fallbackExtension) {
    return `${sanitized}${fallbackExtension}`
  }
  return sanitized
}

const generateObjectKey = (originalName: string, prefix: string, fallbackExtension: string) => {
  const now = new Date()
  const isoDate = now.toISOString().replace(/[:.]/g, '-')
  const random = Math.random().toString(36).slice(2, 10)
  const baseName = sanitizeFileName(originalName, fallbackExtension)
  const normalizedPrefix = prefix.replace(/\/+$/, '')
  return `${normalizedPrefix}/${isoDate}-${random}-${baseName}`
}

const resolveFallbackExtension = (contentType: string, explicit?: string) => {
  if (explicit) {
    return explicit.startsWith('.') ? explicit : `.${explicit}`
  }
  const mapped = CONTENT_TYPE_EXTENSION_MAP.get(contentType)
  if (mapped) {
    return mapped
  }
  return '.bin'
}

export const createPresignedUpload = async (c: Context, params: PresignedUploadParams): Promise<PresignedUpload> => {
  const allowedContentTypes = new Set(params.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES)
  const maxFileSize = params.maxFileSize ?? DEFAULT_MAX_FILE_SIZE
  const fallbackExtension = resolveFallbackExtension(params.contentType, params.fallbackExtension)
  const prefix = params.objectKeyPrefix ?? DEFAULT_OBJECT_PREFIX

  validateFileRequest(params.contentType, params.contentLength, allowedContentTypes, maxFileSize)

  const env = c.get('validatedEnv') as Record<string, string | undefined>
  const bucketName = env.CLOUDFLARE_R2_BUCKET

  if (!bucketName) {
    throw new HTTPException(500, { message: 'バケット名が設定されていません。' })
  }

  const client = createS3Client(env)
  const key = generateObjectKey(params.fileName, prefix, fallbackExtension)

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: params.contentType,
  })

  const expiresIn = 60 // seconds
  const uploadUrl = await getSignedUrl(client, command, { expiresIn })
  const publicBaseUrl = env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.replace(/\/+$/, '')
  const objectUrl = publicBaseUrl
    ? `${publicBaseUrl}/${key}`
    : `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${key}`

  return {
    uploadUrl,
    objectUrl,
    key,
    expiresIn,
  }
}

export const deleteObjectFromR2 = async (c: Context, key: string) => {
  if (!key) {
    return
  }

  const env = c.get('validatedEnv') as Record<string, string | undefined>
  const bucketName = env.CLOUDFLARE_R2_BUCKET

  if (!bucketName) {
    throw new HTTPException(500, { message: 'バケット名が設定されていません。' })
  }

  const client = createS3Client(env)
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    )
  } catch (error) {
    console.error('R2オブジェクトの削除に失敗しました:', error)
  }
}
