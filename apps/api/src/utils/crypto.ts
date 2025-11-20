import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const algorithm = 'aes-256-gcm'
const ivLength = 16 // Initialization vector length
const tagLength = 16 // Authentication tag length

export const encrypt = (text: string, secretKey: string): string => {
  if (!secretKey || secretKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters long.')
  }

  const key = scryptSync(secretKey, 'salt', 32) // Derive a 32-byte key from the secret
  const iv = randomBytes(ivLength)
  const cipher = createCipheriv(algorithm, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`
}

export const decrypt = (encryptedText: string, secretKey: string): string => {
  if (!secretKey || secretKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters long.')
  }

  const key = scryptSync(secretKey, 'salt', 32) // Derive the same key
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const tag = Buffer.from(parts[2], 'hex')

  const decipher = createDecipheriv(algorithm, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
