<script lang='ts'>
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { fade, scale } from 'svelte/transition';
  import type { ModalProps } from './Modal';

  type Props = ModalProps & HTMLAttributes<HTMLDivElement>

  let {
    isOpen = false,
    title = '',
    bodyContent = '',
    footerContent = '',
    closeOnOverlayClick = true,
    customClass = '',
    class: overlayClass = '',
    ...restProps
  }: Props = $props()

  const dispatch = createEventDispatcher()

  const overlayClasses = $derived(
    [
      'inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4',
      overlayClass,
    ]
      .filter(Boolean)
      .join(' ')
  )

  const containerClasses = $derived(
    [
      'bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto',
      customClass,
    ]
      .filter(Boolean)
      .join(' ')
  )

  function closeModal() {
    isOpen = false
    dispatch('close')
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      closeModal()
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isOpen && e.key === 'Escape') {
      closeModal()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
</script>

{#if isOpen}
  <div
    {...restProps}
    class={overlayClasses}
    onclick={handleOverlayClick}
    transition:fade={{ duration: 150 }}
    role='dialog'
    aria-modal='true'
    aria-labelledby='modal-title'
    tabindex='-1'
  >
    <div class={containerClasses} transition:scale={{ duration: 150, start: 0.95 }}>
      {#if title}
        <div class='flex items-center justify-between p-4 border-b border-gray-200'>
          <h3 id='modal-title' class='text-lg font-semibold text-gray-900'>{title}</h3>
          <button
            type='button'
            onclick={closeModal}
            class='text-gray-400 hover:text-gray-600 transition-colors'
            aria-label='Close modal'
          >
            <svg class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>
      {/if}

      <div class='p-4'>
        {@html bodyContent}
      </div>

      {#if footerContent}
        <div class='p-4 border-t border-gray-200 flex justify-end gap-2'>
          {@html footerContent}
        </div>
      {/if}
    </div>
  </div>
{/if}
