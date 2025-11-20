<script lang='ts'>
  import type { HTMLInputAttributes } from 'svelte/elements'
  import type { RadioProps } from './Radio'

  type Props = RadioProps & HTMLInputAttributes

  let {
    name,
    value,
    label = '',
    checked = false,
    disabled = false,
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const containerClasses = $derived(
    ['inline-flex items-center cursor-pointer', customClass].filter(Boolean).join(' ')
  )

  const inputClasses = $derived(
    [
      'form-radio h-5 w-5 text-blue-600',
      'focus:ring-blue-500 focus:ring-offset-0',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      forwardedClass,
    ]
      .filter(Boolean)
      .join(' ')
  )

  const labelClasses = $derived(
    [
      'ml-2 text-gray-700',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
    ]
      .filter(Boolean)
      .join(' ')
  )
</script>

<label class={containerClasses}>
  <input
    {...restProps}
    type='radio'
    {name}
    {value}
    checked={checked}
    disabled={disabled}
    class={inputClasses}
  />
  {#if label}
    <span class={labelClasses}>{label}</span>
  {/if}
</label>
