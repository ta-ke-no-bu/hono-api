import type { Context, Next } from 'hono'

type RateLimitOptions = {
  windowMs?: number
  limit?: number
  keyGenerator?: (c: Context) => string | null | undefined
  onLimitReached?: (c: Context) => Promise<void> | void
}

type RateLimitEntry = {
  count: number
  expiresAt: number
}

type StoreGlobal = typeof globalThis & {
  __RATE_LIMIT_STORE__?: Map<string, RateLimitEntry>
}

const getStore = () => {
  const globalObject = globalThis as StoreGlobal
  if (!globalObject.__RATE_LIMIT_STORE__) {
    globalObject.__RATE_LIMIT_STORE__ = new Map()
  }
  return globalObject.__RATE_LIMIT_STORE__
}

// Cloudflare Workers 互換の軽量レートリミッター
export const rateLimit = ({
  windowMs = 15 * 60 * 1000,
  limit = 100,
  keyGenerator = (c) =>
    c.req.header('CF-Connecting-IP') ?? c.req.raw.headers.get('x-forwarded-for') ?? c.req.ip ?? null,
  onLimitReached,
}: RateLimitOptions = {}) => {
  const store = getStore()

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c)
    if (!key) {
      await next()
      return
    }

    const now = Date.now()
    const entry = store.get(key)

    if (!entry || entry.expiresAt <= now) {
      const expiresAt = now + windowMs
      store.set(key, { count: 1, expiresAt })
      c.header('RateLimit-Limit', `${limit}`)
      c.header('RateLimit-Remaining', `${limit - 1}`)
      c.header('RateLimit-Reset', `${Math.ceil((expiresAt - now) / 1000)}`)
      await next()
      return
    }

    if (entry.count >= limit) {
      const retryAfterSeconds = Math.ceil((entry.expiresAt - now) / 1000)
      c.header('Retry-After', `${retryAfterSeconds}`)
      if (onLimitReached) {
        await onLimitReached(c)
      }
      c.header('RateLimit-Limit', `${limit}`)
      c.header('RateLimit-Remaining', '0')
      c.header('RateLimit-Reset', `${retryAfterSeconds}`)
      return c.json({ message: 'アクセスが集中しています。しばらく待ってから再度お試しください。' }, 429)
    }

    entry.count += 1
    store.set(key, entry)

    c.header('RateLimit-Limit', `${limit}`)
    c.header('RateLimit-Remaining', `${Math.max(limit - entry.count, 0)}`)
    c.header('RateLimit-Reset', `${Math.ceil((entry.expiresAt - now) / 1000)}`)

    await next()
  }
}
