<script lang='ts'>
  import type { HTMLSelectAttributes } from 'svelte/elements'
  import type { SelectProps } from './Select'

  type Props = SelectProps & HTMLSelectAttributes

  let {
    value = '',
    options = [],
    disabled = false,
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const baseClassTokens = [
    'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm',
    'focus:outline-none focus:ring-blue-500 focus:border-blue-500',
    'disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed',
    'appearance-none pr-8 bg-no-repeat bg-right-center',
  ]

  const classes = $derived(
    [...baseClassTokens, customClass, forwardedClass].filter(Boolean).join(' ')
  )

  // カスタムアローアイコン対応: Tailwindのプラグインで補う想定
</script>

<select
  {...restProps}
  bind:value={value}
  disabled={disabled}
  class={classes}
>
  {#each options as option (option.value)}
    <option value={option.value} disabled={option.disabled}>
      {option.label}
    </option>
  {/each}
</select>
