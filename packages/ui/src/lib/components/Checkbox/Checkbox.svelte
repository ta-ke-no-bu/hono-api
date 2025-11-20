<script lang='ts'>
  import type { HTMLInputAttributes } from 'svelte/elements';
  import type { CheckboxProps } from './Checkbox';

  type Props = CheckboxProps & HTMLInputAttributes

  let {
    checked = $bindable(false),
    label = '',
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
      'form-checkbox h-5 w-5 text-blue-600 rounded',
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
    type='checkbox'
    bind:checked={checked}
    disabled={disabled}
    class={inputClasses}
  />
  {#if label}
    <span class={labelClasses}>{label}</span>
  {/if}
</label>
