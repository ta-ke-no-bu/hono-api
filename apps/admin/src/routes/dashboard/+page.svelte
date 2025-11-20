<script lang="ts">
  import { Button } from '@repo/ui';
  import type { PageData } from './$types';

  export let data: PageData;

  type ContactSummary = PageData['contacts'] extends (infer T)[] ? T : never;
  type PostSummary = PageData['posts'] extends (infer T)[] ? T : never;

  let contacts: ContactSummary[] = [];
  let posts: PostSummary[] = [];

  $: {
    const maybeContacts = data && Array.isArray(data.contacts) ? data.contacts : [];
    contacts = maybeContacts as ContactSummary[];
  }
  $: {
    const maybePosts = data && Array.isArray(data.posts) ? data.posts : [];
    posts = maybePosts as PostSummary[];
  }

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

  const formatLabels: Record<string, string> = {
    TITLE_ONLY: 'タイトルのみ',
    LINK: 'リンク',
    DETAIL: '詳細本文',
  };
</script>

<div class="p-8">
  <div class="flex justify-between items-center mb-8">
    <h1 class="text-2xl font-bold">ダッシュボード</h1>
    <form action="/logout" method="POST">
      <Button label="ログアウト" variant="danger" />
    </form>
  </div>

  {#if data.user}
    <p class="mb-8">ようこそ, {data.user.email} さん</p>
  {/if}

  <section class="mb-10">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">お問い合わせ一覧</h2>
      <a href="/contact" class="text-sm font-medium text-indigo-600 hover:text-indigo-800"> もっと見る </a>
    </div>
    <div class="overflow-x-auto bg-white rounded-lg shadow">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >ID</th
            >
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
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >{contact.formName ?? contact.formSlug ?? 'N/A'}</td
                >
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                  >{contact.displayEmail ?? 'N/A'}</td
                >
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.displayName ?? 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800"
                  >
                    {contact.emailStatus}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(contact.createdAt)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a href="/contact/{contact.id}" class="text-indigo-600 hover:text-indigo-900">詳細</a>
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">お問い合わせはありません。</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">投稿一覧</h2>
      <a href="/posts" class="text-sm font-medium text-indigo-600 hover:text-indigo-800"> もっと見る </a>
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
              >表示形式</th
            >
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >公開日</th
            >
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >更新日</th
            >
            <th scope="col" class="relative px-6 py-3">
              <span class="sr-only">詳細</span>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if posts.length > 0}
            {#each posts as post (post.id)}
              <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{post.title}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{post.categoryName ?? '未設定'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >{formatLabels[post.format] ?? post.format}</td
                >
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >{post.publishedAt ? formatDate(post.publishedAt) : '未設定'}</td
                >
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >{post.updatedAt ? formatDate(post.updatedAt) : '未設定'}</td
                >
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a href={`/posts/${post.id}`} class="text-indigo-600 hover:text-indigo-900">詳細</a>
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">投稿はまだありません。</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </section>
</div>
