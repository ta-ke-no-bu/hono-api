import type { HTMLAttributes } from 'svelte/elements'

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean
  title?: string
  bodyContent?: string
  footerContent?: string
  closeOnOverlayClick?: boolean
  customClass?: string
}
