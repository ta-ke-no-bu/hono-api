<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  // Server-sideからロードされたデータを使用
  let auditLogs = data.auditLogs ?? [];
  let totalPages = data.totalPages ?? 0;
  let currentPage = data.currentPage ?? 1;

  $: auditLogs = data.auditLogs ?? [];
  $: totalPages = data.totalPages ?? 0;
  $: currentPage = data.currentPage ?? 1;

  // ページ遷移用関数 (URLパラメータを変更してリロード)
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      // URLパラメータを更新してリロードを実行
      const url = new URL(window.location.href);
      url.searchParams.set('page', page.toString());
      window.location.href = url.toString(); // リロード代替
    }
  }
</script>

<div class="p-8 space-y-8">
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <h1 class="text-3xl font-bold">監査ログ</h1>
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
        <h3 class="text-lg font-medium text-gray-900">監査ログ</h3>
        <p class="mt-2 text-sm text-gray-600">
          ユーザー登録・ログイン・設定変更・メール送信のリトライ失敗や最終失敗など、誰がいつどんな操作やイベントを実行したかを追跡するための履歴
        </p>
      </div>
    </div>
  </section>

  {#if auditLogs.length === 0}
    <p>監査ログはありません。</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white border border-gray-200">
        <thead>
          <tr>
            <th class="py-2 px-4 border-b">ID</th>
            <th class="py-2 px-4 border-b">日時</th>
            <th class="py-2 px-4 border-b">ユーザーID</th>
            <th class="py-2 px-4 border-b">イベントタイプ</th>
            <th class="py-2 px-4 border-b">IPアドレス</th>
            <th class="py-2 px-4 border-b">User Agent</th>
            <th class="py-2 px-4 border-b">詳細</th>
          </tr>
        </thead>
        <tbody>
          {#each auditLogs as log (log.id)}
            <tr>
              <td class="py-2 px-4 border-b">{log.id}</td>
              <td class="py-2 px-4 border-b">{new Date(log.createdAt).toLocaleString('ja-JP')}</td>
              <td class="py-2 px-4 border-b">{log.userId || 'N/A'}</td>
              <td class="py-2 px-4 border-b">{log.eventType}</td>
              <td class="py-2 px-4 border-b">{log.ipAddress || 'N/A'}</td>
              <td class="py-2 px-4 border-b">{log.userAgent || 'N/A'}</td>
              <td class="py-2 px-4 border-b">
                {#if log.details}
                  <pre class="text-xs bg-gray-100 p-1 rounded overflow-auto max-h-20">{JSON.stringify(
                      JSON.parse(log.details),
                      null,
                      2,
                    )}</pre>
                {:else}
                  N/A
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="flex justify-center mt-4 space-x-2">
        <button
          onclick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          class="px-3 py-1 border rounded {currentPage === 1 ? 'bg-gray-200' : 'bg-blue-500 text-white'}"
        >
          前へ
        </button>
        {#each Array.from({ length: totalPages }) as _, i}
          <button
            onclick={() => goToPage(i + 1)}
            disabled={currentPage === i + 1}
            class="px-3 py-1 border rounded {currentPage === i + 1
              ? 'bg-blue-700 text-white'
              : 'bg-blue-500 text-white'}"
          >
            {i + 1}
          </button>
        {/each}
        <button
          onclick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          class="px-3 py-1 border rounded {currentPage === totalPages ? 'bg-gray-200' : 'bg-blue-500 text-white'}"
        >
          次へ
        </button>
      </div>
    {/if}
  {/if}
</div>
