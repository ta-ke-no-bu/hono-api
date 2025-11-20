const sanitizeApiBase = (value?: string) => {
  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }

  const ensureAppApiPath = (input: string) => {
    try {
      const url = new URL(input)
      const normalizedPath = url.pathname.replace(/\/$/, '')
      if (!normalizedPath.endsWith('/app/api')) {
        url.pathname = `${normalizedPath}/app/api`
      }
      return url.toString().replace(/\/$/, '')
    } catch {
      const fallback = input.replace(/\/$/, '')
      return fallback.endsWith('/app/api') ? fallback : `${fallback}/app/api`
    }
  }

  return ensureAppApiPath(trimmed)
}

export const getApiBaseUrl = () => {
  const dev = sanitizeApiBase(import.meta.env.PUBLIC_API_URL_DEV || 'http://localhost:8787/app/api')
  const prod = sanitizeApiBase(import.meta.env.PUBLIC_API_URL || 'http://localhost:8787/app/api')
  if (import.meta.env.DEV && dev) {
    return dev
  }
  return prod
}
