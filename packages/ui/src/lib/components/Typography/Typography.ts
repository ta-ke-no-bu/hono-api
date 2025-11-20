import type { HTMLAttributes } from 'svelte/elements'

export interface TypographyProps extends Omit<HTMLAttributes<HTMLElement>, 'class' | 'className'> {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div'
  text?: string
  color?: string
  weight?: string
  align?: string
  customClass?: string
}
