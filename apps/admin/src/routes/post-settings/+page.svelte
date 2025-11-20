<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import type { PostSettingSummary } from '@lib/types';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { PageData } from './$types';

  export let data: PageData;

  let showDeleteModal = false;
  let settingToDelete: PostSettingSummary | null = null;
  let deleteError: string | null = null;

  let postSettings: PostSettingSummary[] = [];

  $: {
    const maybeSettings = Array.isArray(data?.postSettings) ? data.postSettings : [];
    postSettings = maybeSettings as PostSettingSummary[];
  }

  const DEFAULT_POST_SETTING_SLUG = 'post-default';

  const countDefinitions = (definitions: PostSettingSummary['definitions']): number => {
    if (!definitions || definitions.length === 0) {
      return 0;
    }
    return definitions.reduce((total, definition) => {
      const childCount = countDefinitions(definition.children);
      return total + 1 + childCount;
    }, 0);
  };

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) {
      return '未設定';
    }
    try {
      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const editSetting = (id: string) => {
    goto(`/post-settings/${id}`);
  };

  const deleteConfirm = (setting: PostSettingSummary) => {
    if (setting.slug === DEFAULT_POST_SETTING_SLUG) {
      deleteError = 'デフォルトテンプレートは削除できません。';
      showDeleteModal = false;
      settingToDelete = null;
      return;
    }
    settingToDelete = setting;
    showDeleteModal = true;
    deleteError = null;
  };

  const cancelDelete = () => {
    showDeleteModal = false;
    settingToDelete = null;
    deleteError = null;
  };

  const handleDeleteSubmit: SubmitFunction = async ({ result, update }) => {
    if (!result) {
      return;
    }

    if (result.type === 'success' || result.type === 'redirect') {
      await update();
      deleteError = null;
      showDeleteModal = false;
      settingToDelete = null;
      return;
    }

    if (result.type === 'failure') {
      deleteError = result.data?.message ?? '削除に失敗しました。しばらくしてから再試行してください。';
      return;
    }

    if (result.type === 'error') {
      console.error('投稿設定削除アクションでエラーが発生しました:', result.error);
      deleteError = '削除処理でエラーが発生しました。ログを確認してください。';
    }
  };
</script>

{#if showDeleteModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">投稿設定の削除</h3>
        <button
          type="button"
          onclick={cancelDelete}
          class="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close modal"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="p-4">
        <p class="text-sm text-gray-500">以下の投稿設定を削除しますか？ この操作は取り消せません。</p>
        {#if deleteError}
          <p class="mt-2 text-sm text-red-600">{deleteError}</p>
        {/if}
        {#if settingToDelete}
          <div class="mt-4">
            <h3 class="text-lg font-medium text-gray-900">{settingToDelete.name}</h3>
            <p class="text-sm text-gray-500">スラッグ: {settingToDelete.slug}</p>
          </div>
        {/if}
      </div>
      <div class="p-4 border-t border-gray-200 flex justify-end gap-2">
        <button
          onclick={cancelDelete}
          type="button"
          class="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto sm:text-sm"
        >
          キャンセル
        </button>
        <form method="POST" action="?/delete" class="inline-flex" use:enhance={handleDeleteSubmit}>
          <input type="hidden" name="id" value={settingToDelete?.id ?? ''} />
          <input type="hidden" name="slug" value={settingToDelete?.slug ?? ''} />
          <button
            type="submit"
            class="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:w-auto sm:text-sm"
            disabled={!settingToDelete}
          >
            削除
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

<div class="p-8 space-y-8">
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 class="text-3xl font-bold mb-1">投稿設定一覧</h1>
      <p class="text-sm text-gray-600">投稿のテンプレートを管理します。</p>
    </div>
    <a
      href="/post-settings/new"
      class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      新規投稿設定を作成
    </a>
  </div>
  {#if deleteError && !showDeleteModal}
    <p class="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
      {deleteError}
    </p>
  {/if}

  <div class="overflow-x-auto bg-white rounded-lg shadow">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >名称</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >スラッグ</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >状態</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >フィールド数</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >最終更新日時</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >操作</th
          >
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#if postSettings.length === 0}
          <tr>
            <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">投稿設定はまだありません。</td>
          </tr>
        {:else}
          {#each postSettings as setting (setting.id)}
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{setting.name}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{setting.slug}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {#if setting.status === 'ACTIVE'}
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"
                    >有効</span
                  >
                {:else}
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800"
                    >無効</span
                  >
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{countDefinitions(setting.definitions)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >{formatDateTime(setting.updatedAt ?? null)}</td
              >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <a
                  href={setting.status === 'ACTIVE'
                    ? `/posts/new?postSettingId=${setting.id}&templateName=${encodeURIComponent(setting.name)}`
                    : undefined}
                  class={`inline-flex items-center rounded-md px-3 py-1 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 mr-2 ${setting.status === 'ACTIVE' ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500' : 'bg-slate-300 text-slate-600 cursor-not-allowed focus:ring-slate-300'}`}
                  aria-disabled={setting.status !== 'ACTIVE'}
                >
                  投稿作成
                </a>
                <button
                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mr-2"
                  onclick={() => editSetting(setting.id)}
                  type="button"
                >
                  編集
                </button>
                {#if setting.slug === DEFAULT_POST_SETTING_SLUG}
                  <span class="text-xs text-gray-400">デフォルトテンプレートは削除できません</span>
                {:else}
                  <button
                    class="inline-flex items-center rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    onclick={() => deleteConfirm(setting)}
                    type="button"
                  >
                    削除
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
