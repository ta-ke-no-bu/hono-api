import type { HTMLAttributes } from 'svelte/elements'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  size?: AvatarSize
  initials?: string
  customClass?: string
}
