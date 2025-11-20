import type { HTMLInputAttributes } from 'svelte/elements'

export interface InputProps
  extends Omit<HTMLInputAttributes, 'class' | 'className' | 'disabled' | 'placeholder' | 'type' | 'value'> {
  value?: string
  placeholder?: string
  disabled?: boolean
  customClass?: string
  'on:input'?: (event: Event) => void
  'on:change'?: (event: Event) => void
}
