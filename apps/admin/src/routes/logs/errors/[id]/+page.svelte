<script lang="ts">
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();

  const { errorLog } = data;

  // 日付をフォーマットするヘルパー関数
  function formatDate(dateString: string) {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };
    return new Date(dateString).toLocaleString('ja-JP', options);
  }
</script>

<div class="p-8">
  <div class="mb-8">
    <a href="/logs/errors" class="text-indigo-600 hover:text-indigo-900">&larr; エラーログ一覧に戻る</a>
  </div>

  <h1 class="text-3xl font-bold mb-6">エラーログ詳細</h1>

  {#if errorLog}
    <div class="bg-white shadow rounded-lg p-6 space-y-4">
      <div>
        <h3 class="font-medium text-gray-500">ID</h3>
        <p>{errorLog.id}</p>
      </div>
      <div>
        <h3 class="font-medium text-gray-500">発生日時</h3>
        <p>{formatDate(errorLog.createdAt)}</p>
      </div>
      <div>
        <h3 class="font-medium text-gray-500">ステータスコード</h3>
        <p>{errorLog.statusCode || 'N/A'}</p>
      </div>
      <div>
        <h3 class="font-medium text-gray-500">パス</h3>
        <p>{errorLog.path || 'N/A'}</p>
      </div>
      <div>
        <h3 class="font-medium text-gray-500">エラーメッセージ</h3>
        <p class="whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded-md">{errorLog.errorMessage}</p>
      </div>
      <div>
        <h3 class="font-medium text-gray-500">スタックトレース</h3>
        <pre class="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-2 rounded-md">{errorLog.stackTrace ||
            'N/A'}</pre>
      </div>
    </div>
  {:else}
    <p>エラーログ情報の読み込みに失敗しました。</p>
  {/if}
</div>
