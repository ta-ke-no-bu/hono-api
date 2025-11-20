<script lang="ts">
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();

  const contacts = $derived(Array.isArray(data.contacts) ? data.contacts : []);
  const meta = $derived(
    data.meta
      ? {
          page: data.meta.page ?? 1,
          limit: data.meta.limit ?? contacts.length,
          totalCount: data.meta.totalCount ?? contacts.length,
          totalPages: data.meta.totalPages ?? (contacts.length > 0 ? 1 : 0),
          hasNextPage: Boolean(data.meta.hasNextPage),
          hasPreviousPage: Boolean(data.meta.hasPreviousPage),
        }
      : {
          page: 1,
          limit: contacts.length,
          totalCount: contacts.length,
          totalPages: contacts.length > 0 ? 1 : 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
  );

  const buildPageUrl = (page: number, limit: number) => {
    const params = new URLSearchParams({ limit: String(limit), page: String(page) });
    return `?${params.toString()}`;
  };

  const rangeStart = $derived(meta.totalCount === 0 ? 0 : Math.min((meta.page - 1) * meta.limit + 1, meta.totalCount));
  const rangeEnd = $derived(meta.totalCount === 0 ? 0 : Math.min(meta.page * meta.limit, meta.totalCount));

  // 日付表示を整形
  function formatDate(dateString: string) {
    if (!dateString) {
      return 'N/A';
    }

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    };

    return new Date(dateString).toLocaleString('ja-JP', options);
  }
</script>

<div class="p-8">
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
    <h1 class="text-3xl font-bold">問い合わせ一覧</h1>
    <div class="flex flex-wrap gap-2">
      <a
        href="/settings/contact/forms"
        class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        フォーム管理を開く
      </a>
      <a
        href="/settings/contact"
        class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        メール設定を開く
      </a>
      <a
        href="/dashboard"
        class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        ダッシュボードに戻る
      </a>
    </div>
  </div>

  <div class="overflow-x-auto bg-white rounded-lg shadow">
    <table class="min-w-full divide-y divide-gray-200" aria-label="問い合わせ一覧">
      <thead class="bg-gray-50">
        <tr>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >フォーム</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >メールアドレス</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >名前</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >ステータス</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >受信日時</th
          >
          <th scope="col" class="relative px-6 py-3">
            <span class="sr-only">詳細</span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#if contacts.length > 0}
          {#each contacts as contact (contact.id)}
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.id}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.formName}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                >{contact.displayEmail || 'N/A'}</td
              >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.displayName || 'N/A'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.emailStatus}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(contact.createdAt)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="/contact/{contact.id}" class="text-indigo-600 hover:text-indigo-900">詳細</a>
              </td>
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">問い合わせ情報が存在しませんでした</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
  <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mt-4">
    <p class="text-sm text-gray-600">
      {meta.totalCount}件中 {rangeStart}–{rangeEnd}件を表示
    </p>
    <nav class="flex items-center gap-2" aria-label="問い合わせページ遷移">
      <a
        href={meta.hasPreviousPage ? buildPageUrl(meta.page - 1, meta.limit) : undefined}
        class={`px-3 py-1 rounded-md text-sm font-medium ${meta.hasPreviousPage ? 'text-indigo-600 hover:text-indigo-800 border border-indigo-200' : 'text-gray-400 border border-gray-200 cursor-not-allowed'}`}
        aria-disabled={!meta.hasPreviousPage}
      >
        前へ
      </a>
      <span class="text-sm text-gray-500">ページ {meta.page}{meta.totalPages ? ` / ${meta.totalPages}` : ''}</span>
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
