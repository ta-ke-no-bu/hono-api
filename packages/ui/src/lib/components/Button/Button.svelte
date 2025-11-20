<script lang='ts'>
  import { createEventDispatcher } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import type { ButtonProps } from './Button';

  type Props = ButtonProps & Omit<HTMLButtonAttributes, 'on:click'>

  const dispatch = createEventDispatcher<{
    click: Event
  }>()

  let {
    label,
    size = 'medium',
    variant = 'default',
    disabled = false,
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const baseClasses =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'

  const sizeTokenMap = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-5 py-2.5 text-lg',
  } as const

  const variantTokenMap = {
    default: 'bg-gray-600 text-white hover:bg-gray-700 focus-visible:ring-gray-500',
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
    secondary: 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  } as const

  const sizeClasses = $derived(sizeTokenMap[size])
  const variantClasses = $derived(variantTokenMap[variant])
  const finalClasses = $derived(
    [baseClasses, sizeClasses, variantClasses, customClass, forwardedClass]
      .filter(Boolean)
      .join(' ')
  )
</script>

<button
  onclick={(e) => dispatch('click', e)}
  {...restProps}
  class={finalClasses}
  {disabled}
>
  {label}
</button>
