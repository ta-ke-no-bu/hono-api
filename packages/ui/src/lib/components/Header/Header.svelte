<svelte:options runes={false} />
<script lang='ts'>
  import { Button } from '@repo/ui'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  type MenuItem = {
    href?: string
    label: string
    children?: MenuItem[]
  }

  type User = { email: string }

  export let menuItems: MenuItem[] = []
  export let user: User | null = null
  export let logoText = '管理画面'
  export let logoHref = '/'
  export let headerClass = ''

  let restProps: HTMLAttributes<HTMLElement> = {}
  $: {
    const { class: classAttr, ...others } = $$restProps
    restProps = others
    headerClass = headerClass || (classAttr as string) || ''
  }

  let headerClasses = 'bg-gray-900 p-4 shadow-md'
  $: headerClasses = ['bg-gray-900 p-4 shadow-md', headerClass]
    .filter((value) => Boolean(value && value.length > 0))
    .join(' ')

  const dispatch = createEventDispatcher<{ logout: void }>()

  function handleLogout() {
    dispatch('logout')
  }

  let navElement: HTMLElement | null = null
  let openMenuLabel: string | null = null

  const toggleMenu = (label: string) => {
    openMenuLabel = openMenuLabel === label ? null : label
  }

  const closeMenus = () => {
    openMenuLabel = null
  }

  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as Node | null
    if (navElement && target && !navElement.contains(target)) {
      closeMenus()
    }
  }

  onMount(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('click', handleDocumentClick)
    }
  })

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleDocumentClick)
    }
  })
</script>

<header {...restProps} class={headerClasses}>
  <div class='container mx-auto flex items-center justify-between'>
    <a href={logoHref} class='text-white text-xl font-bold'>{logoText}</a>

    {#if user}
      <div class='flex items-center space-x-6'>
        <nav bind:this={navElement} class='md:flex md:space-x-1 relative'>
          {#each menuItems as item}
            {#if item.children}
              <div class='relative group'>
                <button
                  type='button'
                  class='flex items-center rounded px-3 py-2 text-white hover:bg-gray-700 cursor-pointer'
                  aria-haspopup='menu'
                  aria-expanded={openMenuLabel === item.label}
                  onclick={() => toggleMenu(item.label)}
                >
                  {item.label}
                  <svg
                    class={`ml-1 h-4 w-4 transition-transform ${openMenuLabel === item.label ? 'rotate-180' : ''}`}
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    aria-hidden='true'
                  >
                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'></path>
                  </svg>
                </button>
                {#if openMenuLabel === item.label}
                  <div class='absolute right-0 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-20'>
                    <div class='py-1' role='menu' aria-orientation='vertical'>
                      {#each item.children as child}
                        <a
                          href={child.href}
                          class='block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                          role='menuitem'
                          onclick={closeMenus}
                        >
                          {child.label}
                        </a>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {:else if item.href}
              <a href={item.href} class='rounded px-3 py-2 text-white hover:bg-gray-700'>{item.label}</a>
            {/if}
          {/each}
        </nav>

        <div class='flex items-center'>
          <span class='text-sm text-gray-300'>{user.email}</span>
          <Button
            label='ログアウト'
            variant='default'
            customClass='ml-4 text-sm'
            onclick={handleLogout}
          />
        </div>
      </div>
    {/if}
  </div>
</header>
