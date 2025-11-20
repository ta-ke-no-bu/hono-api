<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData | undefined;

  let user = data.user;

  $: user = data.user;

  const formatDate = (value: string | null | undefined) => {
    if (!value) {
      return '未設定';
    }
    try {
      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  function confirmDeletion(event: MouseEvent) {
    if (!confirm('本当にこのユーザーを削除しますか？')) {
      event.preventDefault();
    }
  }
</script>

<div class="p-8">
  <div class="mb-8">
    <a href="/users" class="text-indigo-600 hover:text-indigo-900">&larr; 会員一覧に戻る</a>
  </div>

  <h1 class="text-3xl font-bold mb-6">会員詳細・編集</h1>

  {#if user}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- ユーザー情報表示 -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">ユーザー情報</h2>
        <div class="space-y-4">
          <div>
            <h3 class="font-medium text-gray-500">ID</h3>
            <p>{user.id}</p>
          </div>
          <div>
            <h3 class="font-medium text-gray-500">メールアドレス</h3>
            <p>{user.email}</p>
          </div>
          <div>
            <h3 class="font-medium text-gray-500">名前</h3>
            <p>{user.name || 'N/A'}</p>
          </div>
          <div>
            <h3 class="font-medium text-gray-500">登録日時</h3>
            <p>{formatDate(user.createdAt)}</p>
          </div>
          <div>
            <h3 class="font-medium text-gray-500">最終更新日時</h3>
            <p>{formatDate(user.updatedAt)}</p>
          </div>
        </div>
      </div>

      <!-- ユーザー情報編集フォーム -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">ユーザー情報編集</h2>
        <form
          method="POST"
          action="?/updateUser"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success') {
                await invalidateAll(); // 成功したらload関数を再実行してページを更新
              }
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
                value={user.email}
                class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700">名前</label>
              <input
                id="name"
                name="name"
                type="text"
                value={user.name || ''}
                class="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:focus:border-indigo-500"
              />
            </div>
          </div>

          <div class="mt-6">
            <button
              type="submit"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              更新
            </button>
          </div>
          {#if form?.success}
            <p class="mt-2 text-sm text-green-600">{form.message}</p>
          {:else if form?.message}
            <p class="mt-2 text-sm text-red-600">{form.message}</p>
          {/if}
        </form>
      </div>
    </div>

    <!-- ユーザー削除ボタン -->
    <div class="mt-8 bg-white shadow rounded-lg p-6">
      <h2 class="text-xl font-semibold mb-4 text-red-600">ユーザー削除</h2>
      <p class="text-gray-700 mb-4">この操作は元に戻せません。本当にこのユーザーを削除しますか？</p>
      <form method="POST" action="?/deleteUser" use:enhance>
        <button
          type="submit"
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          onclick={confirmDeletion}
        >
          ユーザーを削除
        </button>
      </form>
    </div>
  {:else}
    <p>ユーザー情報の読み込みに失敗しました。</p>
  {/if}
</div>
