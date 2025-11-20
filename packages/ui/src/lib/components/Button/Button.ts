import type { HTMLButtonAttributes } from 'svelte/elements'

export interface ButtonProps
  extends Omit<HTMLButtonAttributes, 'class' | 'className' | 'disabled' | 'size'> {
  label: string
  size?: 'small' | 'medium' | 'large'
  variant?: 'default' | 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  customClass?: string
}
