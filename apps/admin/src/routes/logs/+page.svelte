<script lang="ts">
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();

  // 最新5件だけをダッシュボード的に表示
  const recentErrorLogs = data.errorLogs.slice(0, 5);

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

<div class="p-8 space-y-8">
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <h1 class="text-3xl font-bold">ログ管理</h1>
    <a
      href="/dashboard"
      class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      ダッシュボードに戻る
    </a>
  </div>

  <section aria-labelledby="logs-navigation">
    <h2 id="logs-navigation" class="text-xl font-semibold text-gray-900 mb-4">ログ種別</h2>
    <div class="grid gap-4 md:grid-cols-2">
      <div
        class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        <h3 class="text-lg font-medium text-gray-900">エラーログ</h3>
        <p class="mt-2 text-sm text-gray-600">
          APIから収集したエラーログの詳細を確認できます。ステータスコードやスタックトレースを含む完全な情報は一覧ページで参照してください。
        </p>
        <p class="mt-4 text-sm text-gray-500">最新件数: {data.errorLogs.length}</p>
      </div>
    </div>
  </section>

  <section aria-labelledby="logs-recent">
    <h2 id="logs-recent" class="text-xl font-semibold text-gray-900 mb-4">最新のエラーログ</h2>

    <div class="overflow-x-auto bg-white rounded-lg shadow">
      <table class="min-w-full divide-y divide-gray-200" aria-label="最新エラーログ">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >ID</th
            >
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >発生日時</th
            >
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >ステータスコード</th
            >
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >パス</th
            >
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >エラーメッセージ</th
            >
            <th scope="col" class="relative px-6 py-3">
              <span class="sr-only">詳細</span>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if recentErrorLogs.length > 0}
            {#each recentErrorLogs as log (log.id)}
              <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                  >{formatDate(log.createdAt)}</td
                >
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.statusCode ?? 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.path ?? 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.errorMessage}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a href="/logs/errors/{log.id}" class="text-indigo-600 hover:text-indigo-900">詳細</a>
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">エラーログはまだありません。</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>

    {#if data.errorLogs.length > 5}
      <div class="mt-4 text-right">
        <a href="/logs/errors" class="text-sm font-medium text-indigo-600 hover:text-indigo-900"
          >すべてのエラーログを見る</a
        >
      </div>
    {/if}
  </section>
</div>
