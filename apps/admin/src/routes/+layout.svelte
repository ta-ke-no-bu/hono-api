<script lang="ts">
  import { browser } from '$app/environment';
  import { Header } from '@repo/ui';
  import { Toaster } from 'svelte-french-toast';
  import type { LayoutData } from './$types';

  export let data: LayoutData;

  // Only import CSS on client-side to avoid SSR issues
  if (browser) {
    import('../app.css');
  }

  let user: LayoutData['user'] | null = data.user ?? null;
  $: user = data.user ?? null;

  // Headerコンポーネントに渡すメニュー項目のデータ
  const menuItems = [
    { href: '/dashboard', label: 'ダッシュボード' },
    { href: '/users', label: '会員管理' },
    { href: '/contact', label: '問い合わせ' },
    {
      label: '投稿管理',
      children: [
        { href: '/posts', label: '投稿一覧' },
        { href: '/categories', label: 'カテゴリ管理' },
        { href: '/post-settings', label: '投稿設定' },
      ],
    },
    {
      label: 'ログ',
      children: [
        { href: '/logs', label: 'システムログ' },
        { href: '/audit-logs', label: '監査ログ' },
      ],
    },
    { href: '/help', label: 'ヘルプ' },
  ];

  // ログアウト処理
  let logoutForm: HTMLFormElement | null = null;

  function handleLogout() {
    // Headerからlogoutイベントが来たら、このフォームを送信する
    logoutForm?.requestSubmit();
  }
</script>

<!-- ログアウト用のフォームは見えない場所に保持 -->
<form bind:this={logoutForm} action="/logout" method="POST" class="hidden"></form>

<Toaster />
<div class="min-h-screen bg-gray-100">
  <Header logoText="管理画面" logoHref="/dashboard" {user} {menuItems} on:logout={handleLogout} />

  <main class="container mx-auto py-8">
    <slot />
  </main>
</div>
