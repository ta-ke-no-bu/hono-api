import type { HTMLInputAttributes } from 'svelte/elements'

export interface CheckboxProps
  extends Omit<HTMLInputAttributes, 'class' | 'className' | 'checked' | 'disabled' | 'type'> {
  checked?: boolean
  label?: string
  disabled?: boolean
  customClass?: string
  'on:change'?: (event: Event) => void
}
