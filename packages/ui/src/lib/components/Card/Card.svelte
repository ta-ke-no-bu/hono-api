<script lang='ts'>
  import type { CardProps } from './Card'

  type Props = CardProps

  let {
    title = '',
    imageSrc = '',
    bodyContent = '',
    footerContent = '',
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const cardClasses = $derived(
    ['bg-white rounded-lg shadow-md overflow-hidden', customClass, forwardedClass]
      .filter(Boolean)
      .join(' ')
  )

  const imageAlt = $derived(title || 'Card image')
</script>

<div {...restProps} class={cardClasses}>
  {#if imageSrc}
    <img src={imageSrc} alt={imageAlt} class='w-full h-48 object-cover' />
  {/if}

  <div class='p-4'>
    {#if title}
      <h3 class='text-xl font-semibold text-gray-800 mb-2'>{title}</h3>
    {/if}

    {#if bodyContent}
      <div class='text-gray-600 text-sm'>
        {@html bodyContent}
      </div>
    {/if}
  </div>

  {#if footerContent}
    <div class='p-4 border-t border-gray-200 text-sm text-gray-500'>
      {@html footerContent}
    </div>
  {/if}
</div>
