<script lang="ts">
  import { enhance } from '$app/forms';

  type RegisterActionData = {
    message?: string;
    fieldErrors?: {
      email?: string[];
      name?: string[];
      password?: string[];
      confirmPassword?: string[];
    };
    values?: {
      email: string;
      name: string;
    };
  };

  export let form: RegisterActionData | null = null;
</script>

<div class="flex items-center justify-center min-h-screen bg-gray-100">
  <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
    <h1 class="text-2xl font-bold text-center text-gray-900">管理画面アカウント登録</h1>

    <form method="POST" action="?/register" use:enhance>
      <div class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">メールアドレス</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form?.values?.email ?? ''}
            class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {#if form?.fieldErrors?.email?.length}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.email[0]}</p>
          {/if}
        </div>
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700">氏名</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={form?.values?.name ?? ''}
            class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {#if form?.fieldErrors?.name?.length}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.name[0]}</p>
          {/if}
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">パスワード</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p class="mt-1 text-xs text-gray-500">
            パスワードは12文字以上72文字以下で、大文字、小文字、数字、記号（!@#$%^&*）をそれぞれ1つ以上含める必要があります。
          </p>
          {#if form?.fieldErrors?.password?.length}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.password[0]}</p>
          {/if}
        </div>
        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700">パスワード（確認）</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {#if form?.fieldErrors?.confirmPassword?.length}
            <p class="mt-1 text-xs text-red-600">{form.fieldErrors.confirmPassword[0]}</p>
          {/if}
        </div>
      </div>

      {#if form?.message}
        <p class="mt-4 text-sm text-red-600">{form.message}</p>
      {/if}

      <div class="mt-6">
        <button
          type="submit"
          class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          登録する
        </button>
      </div>
    </form>

    <p class="text-sm text-center text-gray-600">
      既にアカウントをお持ちの方は
      <a class="font-medium text-indigo-600 hover:text-indigo-500" href="/login">ログインページ</a>
      へお進みください。
    </p>
  </div>
</div>
