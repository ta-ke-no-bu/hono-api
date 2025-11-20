<script lang='ts'>
  import type { HTMLAttributes } from 'svelte/elements'
  import type { TypographyProps } from './Typography'

  type Props = TypographyProps & HTMLAttributes<HTMLElement>

  let {
    variant = 'p',
    text = '',
    color = 'text-gray-900',
    weight = 'font-normal',
    align = 'text-left',
    customClass = '',
    class: forwardedClass = '',
    ...restProps
  }: Props = $props()

  const variantTagMap = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    p: 'p',
    span: 'span',
    div: 'div',
  } as const

  const defaultVariantMap = {
    h1: 'text-5xl font-extrabold',
    h2: 'text-4xl font-bold',
    h3: 'text-3xl font-semibold',
    h4: 'text-2xl font-semibold',
    h5: 'text-xl font-medium',
    h6: 'text-lg font-medium',
    p: 'text-base',
    span: 'text-base',
    div: 'text-base',
  } as const

  const componentTag = $derived(variantTagMap[variant] ?? 'p')
  const defaultVariantClasses = $derived(defaultVariantMap[variant] ?? defaultVariantMap.p)

  const utilityClasses = $derived(
    [color, weight, align, customClass, forwardedClass].filter(Boolean).join(' ')
  )

  const combinedClasses = $derived(
    [defaultVariantClasses, utilityClasses].filter(Boolean).join(' ')
  )
</script>

<svelte:element this={componentTag} {...restProps} class={combinedClasses}>
  {text}
</svelte:element>
