import type { HTMLInputAttributes } from 'svelte/elements'

export interface RadioProps
  extends Omit<HTMLInputAttributes, 'class' | 'className' | 'checked' | 'disabled' | 'type'> {
  name: string
  value: string
  label?: string
  checked?: boolean
  disabled?: boolean
  customClass?: string
}
