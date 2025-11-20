import type { HTMLTextareaAttributes } from 'svelte/elements'

export interface TextareaProps
  extends Omit<HTMLTextareaAttributes, 'class' | 'className' | 'disabled' | 'placeholder' | 'rows' | 'value'> {
  value?: string
  placeholder?: string
  disabled?: boolean
  rows?: number
  customClass?: string
  'on:input'?: (event: Event) => void
}
