<script lang='ts'>
  import type { FlexProps } from './Flex'

  type Props = FlexProps

  let {
    direction = 'row',
    justify = 'start',
    align = 'stretch',
    gap = 0,
    wrap = 'nowrap',
    items = [],
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const flexClasses = $derived(
    [
      'flex',
      `flex-${direction}`,
      `justify-${justify}`,
      `items-${align}`,
      `gap-${gap}`,
      `flex-${wrap}`,
      customClass,
      forwardedClass,
    ]
      .filter(Boolean)
      .join(' ')
  )
</script>

<div {...restProps} class={flexClasses}>
  {#each items ?? [] as item}
    {@html item}
  {/each}
</div>
