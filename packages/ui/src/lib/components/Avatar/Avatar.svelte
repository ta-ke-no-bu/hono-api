<script lang='ts'>
  import type { AvatarProps, AvatarSize } from './Avatar';

  type Props = AvatarProps

  let {
    src = '',
    alt = 'User Avatar',
    size = 'md' as AvatarSize,
    initials = '',
    customClass = '',
    class: forwardedClass,
    ...restProps
  }: Props = $props()

  let imageError = $state(false)

  const sizeClassMap = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-12 w-12 text-lg',
    lg: 'h-16 w-16 text-xl',
  } as const

  const containerClasses = $derived(
    [
      'inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium overflow-hidden',
      sizeClassMap[size],
      customClass,
      forwardedClass,
    ]
      .filter(Boolean)
      .join(' ')
  )

  const imageClasses = 'w-full h-full object-cover'

  function handleImageError() {
    imageError = true
  }

  $effect(() => {
    if (src) {
      imageError = false
    }
  })
</script>

<div {...restProps} class={containerClasses}>
  {#if src && !imageError}
    <img {src} {alt} class={imageClasses} onerror={handleImageError} />
  {:else if initials}
    <span>{initials.slice(0, 2).toUpperCase()}</span>
  {:else}
    <svg class='h-2/3 w-2/3 text-gray-400' fill='currentColor' viewBox='0 0 24 24'>
      <path d='M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z' />
    </svg>
  {/if}
</div>
