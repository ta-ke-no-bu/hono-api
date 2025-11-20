<script lang="ts">
  import { page } from '$app/stores';
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();
  const pageStore = page;

  const actionState = $derived(
    () => $pageStore.form as { success?: boolean; message?: string; action?: string } | null,
  );

  const formatDateTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const countDefinitions = (definitions: (typeof data.postSettings)[number]['definitions']) => {
    if (!definitions || definitions.length === 0) {
      return 0;
    }
    return definitions.reduce((total, definition) => total + 1 + countDefinitions(definition.children), 0);
  };

  function handleCreatePost(settingName: string) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('toastMessage', `テンプレート「${settingName}」を使用して新規投稿を作成します。`);
    }
  }
</script>

<div class="space-y-8 p-8">
  <header class="flex items-center justify-between">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold">投稿設定管理</h1>
      <p class="text-sm text-gray-600">投稿フォームの構成や詳細ページ生成ルールを投稿設定単位で管理します。</p>
    </div>
    <a
      href="/settings/custom-fields/set/new"
      class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
    >
      新規投稿設定を作成
    </a>
  </header>

  {#if actionState?.message}
    <div
      class={`rounded-md border p-4 text-sm ${actionState.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}
    >
      {actionState.message}
    </div>
  {/if}

  <section class="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-gray-900">投稿設定一覧</h2>
      <p class="text-sm text-gray-500">
        投稿設定は公開済みコンテンツの入力項目にも影響します。編集後は関連投稿を確認してください。
      </p>
    </div>
    {#if data.postSettings.length === 0}
      <p class="text-sm text-gray-600">
        まだ投稿設定が登録されていません。まずは「新規投稿設定を作成」から始めましょう。
      </p>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-600"
                >名称</th
              >
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-600"
                >スラッグ</th
              >
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-600"
                >状態</th
              >
              <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-600"
                >フィールド数</th
              >
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-600"
                >最終更新</th
              >
              <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-600"
                >操作</th
              >
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            {#each data.postSettings as setting}
              {@const definitionCount = countDefinitions(setting.definitions)}
              <tr>
                <td class="px-4 py-3 align-top">
                  <div class="flex flex-col gap-1">
                    <span class="font-medium text-gray-900">{setting.name}</span>
                    {#if setting.description}
                      <span class="text-xs text-gray-500">{setting.description}</span>
                    {/if}
                  </div>
                </td>
                <td class="px-4 py-3 align-top text-sm text-gray-600">
                  <code class="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{setting.slug}</code>
                </td>
                <td class="px-4 py-3 align-top">
                  <span
                    class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${setting.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}
                  >
                    {setting.status === 'ACTIVE' ? '有効' : '無効'}
                  </span>
                </td>
                <td class="px-4 py-3 align-top text-right text-sm text-gray-600">{definitionCount}</td>
                <td class="px-4 py-3 align-top text-sm text-gray-600">{formatDateTime(setting.updatedAt)}</td>
                <td class="px-4 py-3 align-top">
                  <div class="flex justify-end gap-3 text-sm">
                    <a
                      href={`/posts/new?postSettingId=${setting.id}`}
                      class="text-green-600 hover:underline"
                      onclick={() => handleCreatePost(setting.name)}>投稿作成</a
                    >
                    <a href={`/settings/custom-fields/set/${setting.id}`} class="text-indigo-600 hover:underline"
                      >編集</a
                    >
                    <form
                      method="POST"
                      action="?/deleteSetting"
                      onsubmit={(event) => {
                        if (!confirm(`「${setting.name}」を削除しますか？`)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={setting.id} />
                      <button type="submit" class="text-red-600 hover:underline">削除</button>
                    </form>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>
