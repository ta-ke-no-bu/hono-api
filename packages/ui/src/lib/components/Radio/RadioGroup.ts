export interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

import type { HTMLDivAttributes } from 'svelte/elements'

export interface RadioGroupProps extends Omit<HTMLDivAttributes, 'class' | 'className'> {
  name: string
  options: RadioOption[]
  selectedValue: string
}
