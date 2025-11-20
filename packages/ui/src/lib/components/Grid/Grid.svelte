<script lang='ts'>
  import type { GridProps } from './Grid'

  type Props = GridProps

  let {
    cols = 1,
    gap = 4,
    items = [],
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const gridClasses = $derived(
    ['grid', `grid-cols-${cols}`, `gap-${gap}`, customClass, forwardedClass]
      .filter(Boolean)
      .join(' ')
  )
</script>

<div {...restProps} class={gridClasses}>
  {#each items ?? [] as item}
    {@html item}
  {/each}
</div>
