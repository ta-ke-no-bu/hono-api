<script lang="ts">
  import { page } from '$app/stores';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;

  type CategorySummary = PageData['categories'] extends (infer T)[] ? T : never;

  let categories: CategorySummary[] = [];
  let actionState: ActionData | null = null;

  $: {
    const maybeCategories = data && Array.isArray(data.categories) ? data.categories : [];
    categories = maybeCategories as CategorySummary[];
  }
  $: actionState = ($page.form as ActionData | null) ?? null;

  const formatDate = (value: string) => {
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
</script>

<div class="p-8 space-y-8">
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 class="text-3xl font-bold mb-1">カテゴリ管理</h1>
      <p class="text-sm text-gray-600">
        投稿に紐づくカテゴリを作成・確認します。スラッグは英数字とハイフンのみ使用できます。
      </p>
    </div>
    <a
      href="/posts/new"
      class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      投稿を作成
    </a>
  </div>

  <section class="bg-white rounded-lg shadow p-6 space-y-6" aria-labelledby="category-create-heading">
    <div class="flex items-center justify-between">
      <h2 id="category-create-heading" class="text-xl font-semibold">カテゴリを追加</h2>
      {#if actionState?.action === 'create'}
        <p class={`text-sm ${actionState.success ? 'text-green-600' : 'text-red-600'}`}>
          {actionState.success ? 'カテゴリを作成しました。' : actionState.message}
        </p>
      {/if}
    </div>
    <form method="POST" action="?/create" class="grid gap-4 md:grid-cols-2">
      <div class="flex flex-col gap-2">
        <label for="name" class="text-sm font-medium text-gray-700">カテゴリ名</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxlength="60"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="例: お知らせ"
          value={actionState?.fields?.name ?? ''}
        />
      </div>
      <div class="flex flex-col gap-2">
        <label for="slug" class="text-sm font-medium text-gray-700">スラッグ（任意）</label>
        <input
          id="slug"
          name="slug"
          type="text"
          maxlength="80"
          pattern="[A-Za-z0-9-]+"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="例: news"
          value={actionState?.fields?.slug ?? ''}
        />
        <p class="text-xs text-gray-500">英数字とハイフンのみ使用できます（任意）。</p>
      </div>
      <div class="md:col-span-2">
        <button
          type="submit"
          class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          カテゴリを作成
        </button>
      </div>
    </form>
  </section>

  <section class="bg-white rounded-lg shadow p-6 space-y-4" aria-labelledby="category-list-heading">
    <h2 id="category-list-heading" class="text-xl font-semibold">カテゴリ一覧</h2>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >カテゴリ名 / スラッグ</th
            >
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">作成日時</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新日時</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if data.categories.length === 0}
            <tr>
              <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">カテゴリはまだありません。</td>
            </tr>
          {:else}
            {#each categories as category (category.id)}
              <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <form
                    method="POST"
                    action="?/update"
                    class="flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <input
                      name="name"
                      type="text"
                      required
                      maxlength="60"
                      class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:w-48"
                      value={category.name}
                    />
                    <input
                      name="slug"
                      type="text"
                      maxlength="80"
                      pattern="[A-Za-z0-9-]+"
                      class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:w-48"
                      placeholder="例: news"
                      value={category.slug ?? ''}
                    />
                    <button
                      type="submit"
                      class="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                      更新
                    </button>
                    {#if actionState?.action === 'update' && actionState?.updatedId === category.id}
                      <span class={`text-xs ${actionState.success ? 'text-green-600' : 'text-red-600'}`}>
                        {actionState.success ? '更新しました。' : actionState.message}
                      </span>
                    {/if}
                  </form>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(category.createdAt)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(category.updatedAt)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <form
                    method="POST"
                    action="?/delete"
                    onsubmit={(event) => {
                      if (!confirm(`「${category.name}」を削除しますか？この操作は元に戻せません。`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <button
                      type="submit"
                      class="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      削除
                    </button>
                  </form>
                  {#if actionState?.action === 'delete' && actionState?.deletedId === category.id}
                    <span class={`mt-1 block text-xs ${actionState.success ? 'text-green-600' : 'text-red-600'}`}>
                      {actionState.success ? '削除しました。' : actionState.message}
                    </span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </section>
</div>
