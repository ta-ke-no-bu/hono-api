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
  <h1 class="text-3xl font-bold mb-6">会員一覧</h1>

  <div class="overflow-x-auto bg-white rounded-lg shadow">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >メールアドレス</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >名前</th
          >
          <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >登録日時</th
          >
          <th scope="col" class="relative px-6 py-3">
            <span class="sr-only">詳細</span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#if data.users && data.users.length > 0}
          {#each data.users as user (user.id)}
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.id}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.name || 'N/A'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(user.createdAt)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href={`/users/${user.id}`} class="text-indigo-600 hover:text-indigo-900">詳細</a>
              </td>
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">ユーザーはいません。</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
