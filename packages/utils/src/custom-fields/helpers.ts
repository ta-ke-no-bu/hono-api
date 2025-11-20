/**
 * Cloudflare Workers 互換のスラグを camelCase に変換します。
 */
export const slugToCamelCase = (slug: string): string => {
  return slug
    .split(/[-_\s]+/)
    .map((segment, index) => {
      if (index === 0) return segment.toLowerCase()
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    })
    .join('')
}

export const ensureKeyLength = (key: string, maxLength = 32): string => {
  if (key.length <= maxLength) return key
  return key.slice(0, maxLength)
}
