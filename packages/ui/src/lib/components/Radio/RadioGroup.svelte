<script lang='ts'>
  import type { HTMLDivAttributes } from 'svelte/elements'
  import Radio from './Radio.svelte'
  import type { RadioGroupProps } from './RadioGroup'

  type Props = RadioGroupProps & HTMLDivAttributes

  let {
    name,
    options,
    selectedValue,
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  function handleChange(event: Event) {
    selectedValue = (event.target as HTMLInputElement).value
  }

  const containerClasses = $derived(
    ['flex flex-col gap-2', forwardedClass].filter(Boolean).join(' ')
  )
</script>

<div {...restProps} class={containerClasses}>
  {#each options as option}
    <Radio
      name={name}
      value={option.value}
      label={option.label}
      checked={selectedValue === option.value}
      disabled={option.disabled}
      onchange={handleChange}
    />
  {/each}
</div>
