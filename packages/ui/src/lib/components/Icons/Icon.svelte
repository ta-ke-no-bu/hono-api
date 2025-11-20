<script lang='ts'>
  import type { SVGAttributes } from 'svelte/elements'
  import type { IconProps, IconName } from './Icon'

  type Props = IconProps & SVGAttributes<SVGSVGElement>

  let {
    name,
    size = 'md',
    color = 'currentColor',
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const icons: Record<IconName, string> = {
    check: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />',
    x: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />',
    info:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
    alert:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />',
    home:
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m0 0l7-7 7 7M19 10v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />',
  }

  const sizeClassMap = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  } as const

  const svgClasses = $derived(
    [
      'inline-block',
      sizeClassMap[size],
      color === 'currentColor' ? 'text-current' : color,
      customClass,
      forwardedClass,
    ]
      .filter(Boolean)
      .join(' ')
  )
</script>

{#if icons[name]}
  <svg
    {...restProps}
    xmlns='http://www.w3.org/2000/svg'
    fill='none'
    viewBox='0 0 24 24'
    stroke='currentColor'
    class={svgClasses}
  >
    {@html icons[name]}
  </svg>
{:else}
  <span class='text-red-500'>?</span>
{/if}
