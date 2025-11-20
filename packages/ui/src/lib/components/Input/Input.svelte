<script lang='ts'>
  import type { HTMLInputAttributes } from 'svelte/elements';
  import type { InputProps } from './Input';

  type Props = InputProps & HTMLInputAttributes

  let {
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    customClass = '',
    type: inputType = 'text',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const baseClassTokens = [
    'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm',
    'focus:outline-none focus:ring-blue-500 focus:border-blue-500',
    'disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed',
  ]

  const classes = $derived(
    [...baseClassTokens, customClass, forwardedClass].filter(Boolean).join(' ')
  )
</script>

<input
  {...restProps}
  bind:value={value}
  placeholder={placeholder}
  disabled={disabled}
  type={inputType}
  class={classes}
/>
