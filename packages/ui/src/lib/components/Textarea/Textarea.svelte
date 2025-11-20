<script lang='ts'>
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import type { TextareaProps } from './Textarea';

  type Props = TextareaProps & HTMLTextareaAttributes

  let {
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    rows = 3,
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const baseClassTokens = [
    'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm',
    'focus:outline-none focus:ring-blue-500 focus:border-blue-500',
    'disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed',
    'resize-y',
  ]

  const classes = $derived(
    [...baseClassTokens, customClass, forwardedClass].filter(Boolean).join(' ')
  )
</script>

<textarea
  {...restProps}
  bind:value={value}
  placeholder={placeholder}
  disabled={disabled}
  rows={rows}
  class={classes}
></textarea>
