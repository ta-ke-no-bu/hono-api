export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

import type { HTMLSelectAttributes } from 'svelte/elements'

export interface SelectProps
  extends Omit<HTMLSelectAttributes, 'class' | 'className' | 'disabled' | 'multiple' | 'value'> {
  value?: string
  options: SelectOption[]
  disabled?: boolean
  customClass?: string
}
