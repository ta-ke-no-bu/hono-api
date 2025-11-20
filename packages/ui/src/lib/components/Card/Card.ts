import type { HTMLAttributes } from 'svelte/elements'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  imageSrc?: string
  bodyContent?: string
  footerContent?: string
  customClass?: string
}
