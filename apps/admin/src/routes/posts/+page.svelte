<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  let posts: PostSummary[] = [];
  let postSettings: PostSettingSummary[] = [];
  let filterPostSettingId = typeof data?.filters?.postSettingId === 'string' ? (data.filters.postSettingId ?? '') : '';
  let createPostSettingId = filterPostSettingId || 'post-default';
  let meta: MetaSummary = {
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  type MetaSummary = {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  type PostSettingSummary = {
    id: string;
    name: string;
    slug: string;
    status: string;
  };

  type PostSummary = {
    id: string;
    title: string;
    postSettingId: string;
    postSettingName: string | null;
    categoryName: string | null;
    detailEnabled: boolean;
    detailSlug: string | null;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    publishedAt: string | null;
    postedAt: string | null;
    updatedAt: string | null;
  };

  type CategorySummary = PageData['categories'][number];
  type FiltersState = PageData['filters'];

  const CATEGORY_NONE_VALUE = data.categoryNoneValue ?? '__NONE__';
  const DEFAULT_POST_SETTING_SLUG = 'post-default';
  const STATUS_FILTER_OPTIONS: Array<{ value: PostSummary['status']; label: string }> = [
    { value: 'DRAFT', label: '下書き' },
    { value: 'PUBLISHED', label: '公開済み' },
    { value: 'ARCHIVED', label: 'アーカイブ' },
  ];

  const DETAIL_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'false', label: 'なし' },
    { value: 'true', label: 'あり' },
  ];

  let filterForm: HTMLFormElement | null = null;
  let pageInput: HTMLInputElement | null = null;

  let lastFilters: FiltersState = data.filters;
  let currentFilters: FiltersState = data.filters;

  let keywordFilter = data.filters?.keyword ?? '';
  let titleFilter = data.filters?.title ?? '';
  let categoryFilter = data.filters?.categoryId ?? '';
  let statusFilter = data.filters?.status ?? '';
  let detailFilter = data.filters?.detailEnabled ?? '';
  let categories: CategorySummary[] = Array.isArray(data?.categories) ? (data.categories as CategorySummary[]) : [];

  let showDeleteModal = false;
  let postToDelete: PostSummary | null = null;
  let deleteError: string | null = null;
  let isDeleting = false;

  const submitFilters = () => {
    if (pageInput) {
      pageInput.value = '1';
    }
    filterForm?.requestSubmit?.();
  };

  const resetFilters = () => {
    keywordFilter = '';
    titleFilter = '';
    categoryFilter = '';
    statusFilter = '';
    detailFilter = '';
    filterPostSettingId = '';
    createPostSettingId = 'post-default';
    if (pageInput) {
      pageInput.value = '1';
    }
    void goto('/posts');
  };
  const cancelDelete = () => {
    showDeleteModal = false;
    postToDelete = null;
    deleteError = null;
  };

  const handleDeleteSubmit = async (event: SubmitEvent) => {
    event.preventDefault();

    const form = event.currentTarget as HTMLFormElement | null;
    if (!form) {
      console.warn('[posts/delete] submit without form element');
      return;
    }

    isDeleting = true;
    deleteError = null;

    console.warn('[posts/delete] submit started', {
      action: form.action,
      method: form.method,
      postToDelete,
      filterPostSettingId,
    });

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: new FormData(form),
        headers: {
          accept: 'application/json',
        },
      });

      let result: unknown = null;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        result = await response.json();
      } else {
        result = await response.text();
      }

      console.warn('[posts/delete] fetch response', {
        status: response.status,
        ok: response.ok,
        result,
      });

      if (response.ok) {
        showDeleteModal = false;
        postToDelete = null;
        isDeleting = false;
        await goto(window.location.pathname + window.location.search, {
          invalidateAll: true,
          keepfocus: true,
          noscroll: true,
        });
        return;
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        showDeleteModal = false;
        postToDelete = null;
        isDeleting = false;
        if (location) {
          await goto(location, { invalidateAll: true });
        } else {
          await goto(window.location.pathname + window.location.search, {
            invalidateAll: true,
            keepfocus: true,
            noscroll: true,
          });
        }
        return;
      }

      deleteError =
        (typeof result === 'object' && result !== null && 'message' in result
          ? (result as { message?: string }).message
          : undefined) ?? '削除に失敗しました。しばらくしてから再試行してください。';
      showDeleteModal = true;
    } catch (error) {
      console.error('投稿削除フェッチでエラーが発生しました:', error);
      deleteError = '削除処理で通信エラーが発生しました。';
      showDeleteModal = true;
    } finally {
      isDeleting = false;
      console.warn('[posts/delete] submit finished', {
        isDeleting,
        showDeleteModal,
        postToDelete,
        deleteError,
      });
    }
  };

  $: {
    const maybePosts = Array.isArray(data?.posts) ? data.posts : [];
    posts = maybePosts as PostSummary[];
  }

  $: postSettings = Array.isArray(data?.postSettings) ? (data.postSettings as PostSettingSummary[]) : [];
  let selectablePostSettings: PostSettingSummary[] = [];
  $: selectablePostSettings = Array.isArray(postSettings)
    ? postSettings.filter((setting) => setting.slug !== DEFAULT_POST_SETTING_SLUG)
    : [];
  let hasActiveSelectablePostSettings = false;
  $: hasActiveSelectablePostSettings = selectablePostSettings.some((setting) => setting.status === 'ACTIVE');
  $: categories = Array.isArray(data?.categories) ? (data.categories as CategorySummary[]) : [];

  $: if (lastFilters !== data.filters) {
    lastFilters = data.filters;
    currentFilters = data.filters;
    filterPostSettingId = typeof data.filters?.postSettingId === 'string' ? (data.filters.postSettingId ?? '') : '';
    keywordFilter = data.filters?.keyword ?? '';
    titleFilter = data.filters?.title ?? '';
    categoryFilter = data.filters?.categoryId ?? '';
    statusFilter = data.filters?.status ?? '';
    detailFilter = data.filters?.detailEnabled ?? '';
    createPostSettingId = filterPostSettingId || 'post-default';
  }

  let selectedPostSetting: PostSettingSummary | undefined;
  let hasPostSettings = false;
  let disableTemplateActions = false;
  let newPostHref = '/posts/new';

  $: selectedPostSetting =
    createPostSettingId && createPostSettingId !== 'post-default' && Array.isArray(postSettings)
      ? postSettings.find((setting) => setting.id === createPostSettingId)
      : undefined;

  $: hasPostSettings = Array.isArray(postSettings) && postSettings.length > 0;
  $: newPostHref = createPostSettingId ? `/posts/new?postSettingId=${createPostSettingId}` : '/posts/new';
  $: disableTemplateActions = !hasPostSettings;

  $: meta = (() => {
    const source = data?.meta;

    if (source) {
      return {
        page: source.page ?? 1,
        limit: source.limit ?? posts.length,
        totalCount: source.totalCount ?? posts.length,
        totalPages: source.totalPages ?? (posts.length > 0 ? 1 : 0),
        hasNextPage: Boolean(source.hasNextPage),
        hasPreviousPage: Boolean(source.hasPreviousPage),
      } satisfies MetaSummary;
    }

    return {
      page: 1,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    } satisfies MetaSummary;
  })();

  const buildPageUrl = (page: number, limit: number) => {
    const params = new URLSearchParams({ limit: String(limit), page: String(page) });
    if (currentFilters?.postSettingId) {
      params.set('postSettingId', currentFilters.postSettingId);
    }
    if (currentFilters?.keyword) {
      params.set('keyword', currentFilters.keyword);
    }
    if (currentFilters?.title) {
      params.set('title', currentFilters.title);
    }
    if (currentFilters?.categoryId) {
      params.set('categoryId', currentFilters.categoryId);
    }
    if (currentFilters?.status) {
      params.set('status', currentFilters.status);
    }
    if (currentFilters?.detailEnabled) {
      params.set('detailEnabled', currentFilters.detailEnabled);
    }
    return `?${params.toString()}`;
  };

  let rangeStart = 0;
  let rangeEnd = 0;

  $: rangeStart = meta.totalCount === 0 ? 0 : Math.min((meta.page - 1) * meta.limit + 1, meta.totalCount);
  $: rangeEnd = meta.totalCount === 0 ? 0 : Math.min(meta.page * meta.limit, meta.totalCount);

  const statusLabels: Record<PostSummary['status'], string> = {
    DRAFT: '下書き',
    PUBLISHED: '公開済み',
    ARCHIVED: 'アーカイブ',
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

  const editPost = (id: string) => {
    goto(`/posts/${id}`);
  };

  const deletePostConfirm = (post: PostSummary) => {
    console.warn('[posts/delete] deletePostConfirm', post);
    postToDelete = post;
    showDeleteModal = true;
    deleteError = null;
  };
</script>

{#if showDeleteModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">投稿の削除</h3>
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
        <p class="text-sm text-gray-500">以下の投稿を削除しますか？ この操作は取り消せません。</p>
        {#if deleteError}
          <p class="mt-2 text-sm text-red-600">{deleteError}</p>
        {/if}
        {#if postToDelete}
          <div class="mt-4">
            <h3 class="text-lg font-medium text-gray-900">{postToDelete.title}</h3>
            <p class="text-sm text-gray-500">カテゴリ: {postToDelete.categoryName ?? '未設定'}</p>
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
        <form method="POST" action="?/delete" class="inline-flex" onsubmit={(event) => handleDeleteSubmit(event)}>
          <input type="hidden" name="currentPostSettingId" value={filterPostSettingId} />
          <input type="hidden" name="postId" value={postToDelete?.id ?? ''} />
          <button
            type="submit"
            class="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed sm:w-auto sm:text-sm"
            disabled={!postToDelete || isDeleting}
            aria-busy={isDeleting}
          >
            {isDeleting ? '削除中…' : '削除'}
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

<div class="p-8 space-y-8">
  <div class="">
    <div>
      <h1 class="text-3xl font-bold mb-1">投稿一覧</h1>
      <p class="text-sm text-gray-600">投稿の概要を確認し、詳細編集や削除は各行の操作から行ってください。</p>
    </div>
    <div class="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-end md:gap-4" aria-label="投稿作成設定">
      <div class="flex w-full flex-col gap-1 md:w-80">
        <label for="create-postSettingId" class="text-sm font-medium text-gray-700">テンプレート選択</label>
        <select
          id="create-postSettingId"
          class="w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          bind:value={createPostSettingId}
          disabled={disableTemplateActions}
          class:appearance-none={disableTemplateActions}
          class:bg-none={disableTemplateActions}
          onchange={(event) => {
            createPostSettingId = event.currentTarget.value || 'post-default';
          }}
        >
          <option value="post-default">テンプレートなし（デフォルト）</option>
          {#each selectablePostSettings as setting (setting.id)}
            <option value={setting.id}>
              {setting.name}{setting.status === 'INACTIVE' ? '（無効）' : ''}
            </option>
          {/each}
        </select>
        <p class="text-xs text-gray-500">テンプレートなしはデフォルトを使用します。</p>
      </div>
      <div class="flex flex-col gap-1 md:items-end md:w-60">
        {#if disableTemplateActions}
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
            disabled
            aria-disabled="true"
          >
            新規投稿を作成
          </button>
          <p class="text-xs text-gray-600">
            テンプレートが未作成です。
            <a href="/post-settings/new" class="text-indigo-600 hover:underline">投稿設定を作成</a>
            してから再度お試しください。
          </p>
          <a href="/posts/new" class="text-xs text-indigo-600 hover:underline"> テンプレートなしで投稿する </a>
        {:else}
          {#if selectedPostSetting && selectedPostSetting.status !== 'ACTIVE'}
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-500 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
              disabled
              aria-disabled="true"
            >
              新規投稿を作成
            </button>
            <p class="text-xs text-amber-600">
              選択したテンプレートは無効です。テンプレートを有効化するか「テンプレートなし」を選択してください。
            </p>
            <a href="/posts/new" class="text-xs text-indigo-600 hover:underline">テンプレートなしで投稿する</a>
          {:else}
            <a
              href={newPostHref}
              class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              新規投稿を作成
            </a>
            {#if createPostSettingId === 'post-default'}
              <p class="text-xs text-gray-600">デフォルトで作成します。</p>
            {:else if selectedPostSetting}
              <p class="text-xs text-gray-600">テンプレート「{selectedPostSetting.name}」で作成します。</p>
            {/if}
          {/if}
          {#if selectablePostSettings.length > 0 && !hasActiveSelectablePostSettings}
            <p class="text-xs text-amber-600">
              有効なテンプレートがありません。テンプレートを有効化すると選択できます。
            </p>
          {/if}
        {/if}
      </div>
    </div>
    <details
      class="filter-accordion mt-5 w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm md:w-auto"
    >
      <summary
        class="flex cursor-pointer select-none items-center justify-between gap-3 text-base font-semibold text-gray-800"
      >
        <h2 class="text-base font-semibold text-gray-800">検索・絞り込み</h2>
        <svg
          class="accordion-icon h-4 w-4 text-gray-500 transition-transform"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          ></path>
        </svg>
      </summary>
      <div class="mt-4 flex w-full flex-col gap-4">
        <form method="GET" class="flex w-full flex-col gap-4" bind:this={filterForm} aria-label="投稿の絞り込み">
          <input type="hidden" name="limit" value={meta.limit} />
          <input type="hidden" name="page" value="1" bind:this={pageInput} />

          <fieldset class="flex flex-col gap-3 rounded-md border border-gray-100 bg-gray-50/70 p-3 md:p-4 w-xlg">
            <legend class="text-sm font-semibold text-gray-700">キーワード検索</legend>
            <div class="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
              <div class="flex flex-col gap-1 md:w-72">
                <label for="filter-keyword" class="text-sm font-medium text-gray-700">キーワード</label>
                <input
                  id="filter-keyword"
                  name="keyword"
                  type="search"
                  placeholder="タイトル・カスタムフィールドで検索"
                  class="rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  bind:value={keywordFilter}
                />
              </div>
              <div class="flex flex-col gap-1 md:w-72">
                <label for="filter-title" class="text-sm font-medium text-gray-700">タイトル</label>
                <input
                  id="filter-title"
                  name="title"
                  type="search"
                  placeholder="タイトルで検索"
                  class="rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  bind:value={titleFilter}
                />
              </div>
              <button
                type="submit"
                class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                検索
              </button>
            </div>
            <p class="text-xs text-gray-500">カスタムフィールド値は部分一致で検索されます（英数字・記号を含む）。</p>
          </fieldset>

          <fieldset class="flex flex-col gap-3 rounded-md border border-gray-100 bg-gray-50/70 p-3 md:p-4">
            <legend class="text-sm font-semibold text-gray-700">絞り込み</legend>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div class="flex flex-col gap-1">
                <label for="filter-postSettingId" class="text-sm font-medium text-gray-700">投稿設定</label>
                <select
                  id="filter-postSettingId"
                  name="postSettingId"
                  class="w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  bind:value={filterPostSettingId}
                  onchange={(event) => {
                    const value = event.currentTarget.value;
                    filterPostSettingId = value;
                    createPostSettingId = value || 'post-default';
                    submitFilters();
                  }}
                >
                  <option value="">すべて</option>
                  <option value="post-default">テンプレートなし（デフォルト）</option>
                  {#each selectablePostSettings as setting (setting.id)}
                    <option value={setting.id}>
                      {setting.name}{setting.status === 'INACTIVE' ? '（無効）' : ''}
                    </option>
                  {/each}
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <label for="filter-category" class="text-sm font-medium text-gray-700">カテゴリ</label>
                <select
                  id="filter-category"
                  name="categoryId"
                  class="w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  bind:value={categoryFilter}
                  onchange={(event) => {
                    categoryFilter = event.currentTarget.value;
                    submitFilters();
                  }}
                >
                  <option value="">すべて</option>
                  <option value={CATEGORY_NONE_VALUE}>カテゴリ未設定</option>
                  {#each categories as category (category.id)}
                    <option value={category.id}>{category.name}</option>
                  {/each}
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <label for="filter-status" class="text-sm font-medium text-gray-700">ステータス</label>
                <select
                  id="filter-status"
                  name="status"
                  class="w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  bind:value={statusFilter}
                  onchange={(event) => {
                    statusFilter = event.currentTarget.value;
                    submitFilters();
                  }}
                >
                  <option value="">すべて</option>
                  {#each STATUS_FILTER_OPTIONS as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <label for="filter-detail" class="text-sm font-medium text-gray-700">詳細ページ</label>
                <select
                  id="filter-detail"
                  name="detailEnabled"
                  class="w-full rounded-md border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  bind:value={detailFilter}
                  onchange={(event) => {
                    detailFilter = event.currentTarget.value;
                    submitFilters();
                  }}
                >
                  <option value="">すべて</option>
                  {#each DETAIL_FILTER_OPTIONS as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </div>
            </div>
          </fieldset>

          <div class="flex flex-col gap-2 pt-1 md:flex-row md:justify-end">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              onclick={resetFilters}
            >
              リセット
            </button>
          </div>
        </form>
      </div>
    </details>
  </div>

  <div class="overflow-x-auto bg-white rounded-lg shadow">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >タイトル</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >カテゴリ</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >投稿設定</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >ステータス</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >詳細ページ</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >投稿日</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >公開日</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >更新日</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >操作</th
          >
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#if posts.length === 0}
          <tr>
            <td colspan="9" class="px-6 py-4 text-center text-sm text-gray-500">投稿はまだありません。</td>
          </tr>
        {:else}
          {#each posts as post (post.id)}
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{post.title}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{post.categoryName ?? '未設定'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{post.postSettingName ?? '投稿設定なし'}</td
              >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span
                  class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    post.status === 'PUBLISHED'
                      ? 'bg-green-100 text-green-800'
                      : post.status === 'ARCHIVED'
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}>{statusLabels[post.status] ?? post.status}</span
                >
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {#if post.detailEnabled}
                  <span>
                    生成済み{post.detailSlug ? `（${post.detailSlug}）` : '（slug未設定）'}
                  </span>
                {:else}
                  <span>なし</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(post.postedAt ?? null)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >{formatDateTime(post.publishedAt ?? null)}</td
              >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(post.updatedAt ?? null)}</td
              >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <button
                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mr-2"
                  onclick={() => editPost(post.id)}
                  type="button"
                >
                  編集
                </button>
                <button
                  class="inline-flex items-center rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  onclick={() => deletePostConfirm(post)}
                  type="button"
                >
                  削除
                </button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
  <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mt-4">
    <p class="text-sm text-gray-600">
      {meta.totalCount}件中 {rangeStart}–{rangeEnd}件を表示
    </p>
    <nav class="flex items-center gap-2" aria-label="投稿ページ遷移">
      <a
        href={meta.hasPreviousPage ? buildPageUrl(meta.page - 1, meta.limit) : undefined}
        class={`px-3 py-1 rounded-md text-sm font-medium ${meta.hasPreviousPage ? 'text-indigo-600 hover:text-indigo-800 border border-indigo-200' : 'text-gray-400 border border-gray-200 cursor-not-allowed'}`}
        aria-disabled={!meta.hasPreviousPage}
      >
        前へ
      </a>
      <div class="text-sm text-gray-500">
        <span>ページ {meta.page}</span>
        {#if meta.totalPages && meta.totalPages > 0}
          <span> / {meta.totalPages}</span>
        {/if}
      </div>
      <a
        href={meta.hasNextPage ? buildPageUrl(meta.page + 1, meta.limit) : undefined}
        class={`px-3 py-1 rounded-md text-sm font-medium ${meta.hasNextPage ? 'text-indigo-600 hover:text-indigo-800 border border-indigo-200' : 'text-gray-400 border border-gray-200 cursor-not-allowed'}`}
        aria-disabled={!meta.hasNextPage}
      >
        次へ
      </a>
    </nav>
  </div>
</div>

<style>
  details.filter-accordion summary::-webkit-details-marker {
    display: none;
  }

  details.filter-accordion summary {
    list-style: none;
  }

  details.filter-accordion[open] .accordion-icon {
    transform: rotate(180deg);
  }
</style>
