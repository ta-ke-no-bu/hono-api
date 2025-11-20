import type { HTMLAttributes } from 'svelte/elements'

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  color?: string
  customClass?: string
}
