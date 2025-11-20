<script lang='ts'>
  import type { SpinnerProps } from './Spinner'

  type Props = SpinnerProps

  let {
    size = 'md',
    color = 'text-blue-500',
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const sizeClassMap = {
    sm: 'h-4 w-4' as const,
    md: 'h-8 w-8' as const,
    lg: 'h-12 w-12' as const,
  }

  const spinnerClasses = $derived(
    [
      'animate-spin rounded-full border-2 border-solid border-current border-r-transparent',
      sizeClassMap[size],
      color,
      customClass,
      forwardedClass,
    ]
      .filter(Boolean)
      .join(' ')
  )
</script>

<div {...restProps} class={spinnerClasses} role='status'>
  <span class='sr-only'>Loading...</span>
</div>
