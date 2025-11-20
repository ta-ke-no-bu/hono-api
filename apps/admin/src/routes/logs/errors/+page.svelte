<script lang="ts">
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();

  // 日付をフォーマットするヘルパー関数
  function formatDate(dateString: string) {
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
  <h1 class="text-3xl font-bold mb-6">エラーログ一覧</h1>

  <div class="overflow-x-auto bg-white rounded-lg shadow">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
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
        {#if data.errorLogs && data.errorLogs.length > 0}
          {#each data.errorLogs as log (log.id)}
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.id}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatDate(log.createdAt)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.statusCode || 'N/A'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.path || 'N/A'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.errorMessage}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="/logs/errors/{log.id}" class="text-indigo-600 hover:text-indigo-900">詳細</a>
              </td>
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">エラーログはありません。</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
