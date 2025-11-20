<script lang="ts">
  import { dev } from '$app/environment';
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  type LoginActionData = {
    message?: string;
    fieldErrors?: {
      email?: string[];
      password?: string[];
    };
    values?: {
      email: string;
    };
  };

  type TurnstileRenderOptions = {
    sitekey: string;
    callback: (token: string) => void;
    'error-callback'?: (error: unknown) => void;
    'timeout-callback'?: () => void;
    'expired-callback'?: () => void;
  };

  interface TurnstileGlobal {
    render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string | undefined;
    reset?: (widgetId?: string) => void;
  }

  declare global {
    interface Window {
      turnstile?: TurnstileGlobal;
    }
  }

  export let form: LoginActionData;
  export let data: PageData;

  let isSubmitting = false;
  let turnstileToken = '';
  let turnstileWidgetId: string | null = null;

  const siteKey = import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY;
  console.warn('VITE_PUBLIC_TURNSTILE_SITE_KEY:', siteKey);
  console.warn('Environment:', dev ? 'development' : 'production');

  // サイトキーの検証
  if (!siteKey || siteKey === '') {
    console.error('Turnstile site key is not configured');
  }

  onMount(() => {
    console.warn('Initializing Turnstile with site key:', siteKey);
    console.warn('Environment:', dev ? 'development' : 'production');

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      console.warn('Turnstile script loaded');
      const turnstile = window.turnstile;
      if (turnstile) {
        console.warn('Rendering Turnstile widget');
        try {
          turnstileWidgetId = turnstile.render('#cf-turnstile', {
            sitekey: siteKey,
            callback: (token: string) => {
              console.warn(`Turnstile token generated successfully: ${token.substring(0, 20)}...`);
              turnstileToken = token;
            },
            'error-callback': (error: unknown) => {
              console.error('Turnstile widget error:', error);
              turnstileToken = '';
            },
            'timeout-callback': () => {
              console.error('Turnstile widget timeout');
              turnstileToken = '';
            },
            'expired-callback': () => {
              console.warn('Turnstile token expired');
              turnstileToken = '';
            },
          });
          console.warn('Turnstile widget rendered with ID:', turnstileWidgetId);
        } catch (error) {
          console.error('Error rendering Turnstile widget:', error);
        }
      } else {
        console.error('Turnstile API not available after script load');
      }
    };
    script.onerror = () => {
      console.error('Failed to load Turnstile script');
    };
    document.head.appendChild(script);
  });

  function resetTurnstile() {
    const turnstile = window.turnstile;
    if (turnstileWidgetId !== null && turnstile) {
      turnstile.reset?.(turnstileWidgetId);
      turnstileToken = '';
    }
  }
</script>

<div class="flex items-center justify-center min-h-screen bg-gray-100">
  <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
    <h1 class="text-2xl font-bold text-center text-gray-900">管理画面ログイン</h1>

    {#if data.successMessage}
      <p class="p-3 text-sm text-green-700 bg-green-100 border border-green-200 rounded">{data.successMessage}</p>
    {/if}

    <form
      method="POST"
      action="?/login"
      use:enhance={({ formData, cancel }) => {
        // Turnstile処理（全環境で必須）
        if (!turnstileToken) {
          console.error('Turnstile token is required but not available');
          resetTurnstile();
          cancel();
          return;
        }
        formData.set('turnstileToken', turnstileToken);
        console.warn('Turnstile token added to form data:', turnstileToken);

        isSubmitting = true;

        return async ({ result, update }) => {
          console.warn('Form submission result:', result);

          if (result.type === 'failure') {
            isSubmitting = false; // 失敗時のみリセット
            // ログイン失敗時はTurnstileをリセット
            resetTurnstile();
            await update();
            return;
          }

          await update();
        };
      }}
    >
      <div class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">メールアドレス</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxlength="254"
            class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {#if form?.fieldErrors?.email?.length}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.email[0]}</p>
          {/if}
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">パスワード</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            maxlength="64"
            class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {#if form?.fieldErrors?.password?.length}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.password[0]}</p>
          {/if}
        </div>
      </div>

      {#if form?.message}
        <p class="mt-4 text-sm text-red-600">{form.message}</p>
      {/if}

      <div class="mt-6">
        <div class="cf-turnstile" id="cf-turnstile" data-sitekey={siteKey}></div>
      </div>

      <div class="mt-6">
        <button
          type="submit"
          disabled={isSubmitting || !turnstileToken}
          class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isSubmitting}
            ログイン中...
          {:else}
            ログイン
          {/if}
        </button>
      </div>
    </form>

    <p class="text-sm text-center text-gray-600">
      アカウントをお持ちでない場合は
      <a class="font-medium text-indigo-600 hover:text-indigo-500" href="/register">新規登録</a>
      へお進みください。
    </p>
  </div>
</div>
