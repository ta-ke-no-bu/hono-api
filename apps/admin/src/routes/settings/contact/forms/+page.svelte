<script lang="ts">
  import { Button, Input } from '@repo/ui';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData | undefined;

  const successMessageMap = {
    create: 'フォームの登録が完了しました。',
    delete: 'フォームを削除しました。',
  } as const;

  let createName = '';
  let createSlug = '';
  let successMessage: string | undefined;
  let errorMessage: string | undefined;

  const slugHintId = 'contact-form-slug-hint';

  /**
   * @description 削除確認ダイアログを表示し、キャンセル時は送信を中断します。
   */
  const confirmDeletion = (event: Event) => {
    if (typeof window === 'undefined') {
      return;
    }

    const shouldDelete = window.confirm('このフォームを削除します。削除後は元に戻せません。\n本当によろしいですか？');

    if (!shouldDelete) {
      event.preventDefault();
    }
  };

  // アクション結果に応じて作成フォームの値とメッセージを同期する
  $: if (form?.action === 'create' && form.fields) {
    createName = form.fields.name ?? '';
    createSlug = form.fields.slug ?? '';
  }

  $: if (form?.action === 'create' && form?.success) {
    createName = '';
    createSlug = '';
  }

  $: successMessage =
    form?.success && form?.action && form.action in successMessageMap
      ? (successMessageMap[form.action as keyof typeof successMessageMap] ?? '処理が完了しました。')
      : undefined;

  $: errorMessage = form?.message ?? undefined;
</script>

<div class="p-8 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">フォーム管理</h1>
      <p class="text-sm text-gray-500 mt-1">お問い合わせフォームのメタ情報を管理します。</p>
    </div>
    <a
      href="/settings/contact"
      class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      メール設定に戻る
    </a>
  </div>

  {#if errorMessage}
    <div role="alert" class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {errorMessage}
    </div>
  {/if}

  {#if successMessage}
    <div role="status" class="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
      {successMessage}
    </div>
  {/if}

  <div class="bg-white shadow rounded-lg p-6 space-y-3">
    <h2 class="text-lg font-medium text-gray-900">フォーム定義の管理方法</h2>
    <p class="text-sm text-gray-600">メタ情報（通知メール、公開設定など）の編集は各フォームの「編集」から行えます。</p>
  </div>

  <div class="bg-white shadow rounded-lg p-6 space-y-6">
    <div>
      <h2 class="text-lg font-medium text-gray-900">新しいフォームを登録</h2>
      <p class="mt-1 text-sm text-gray-600">
        フォーム名とスラッグを入力して作成します。スラッグは外部公開時の識別子として利用されます。
      </p>
    </div>
    <form method="POST" class="grid grid-cols-1 gap-4 md:grid-cols-3" action="?/create" aria-describedby={slugHintId}>
      <div class="md:col-span-1">
        <label class="block text-sm font-medium text-gray-700" for="name">フォーム名</label>
        <Input id="name" name="name" type="text" required bind:value={createName} aria-required="true" />
      </div>
      <div class="md:col-span-1">
        <label class="block text-sm font-medium text-gray-700" for="slug">スラッグ</label>
        <Input
          id="slug"
          name="slug"
          type="text"
          required
          bind:value={createSlug}
          placeholder="例: default"
          aria-describedby={slugHintId}
          aria-required="true"
        />
        <p id={slugHintId} class="mt-1 text-xs text-gray-500">半角英数字とハイフンのみで指定してください。</p>
      </div>
      <div class="md:col-span-1 flex items-center">
        <Button type="submit" label="作成する" variant="primary" size="medium" />
      </div>
    </form>
  </div>

  <div class="bg-white shadow overflow-hidden sm:rounded-lg">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">フォーム名</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">スラッグ</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状態</th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#if data.forms.length === 0}
          <tr>
            <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">フォームがまだ登録されていません</td>
          </tr>
        {:else}
          {#each data.forms as formItem}
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formItem.name}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formItem.slug}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formItem.isActive ? '公開' : '非公開'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <a
                  href={`/settings/contact/forms/${formItem.id}`}
                  class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                >
                  編集
                </a>
                <form method="POST" class="inline" action="?/delete">
                  <input type="hidden" name="formId" value={formItem.id} />
                  <Button
                    type="submit"
                    label="削除"
                    variant="danger"
                    size="small"
                    onclick={confirmDeletion}
                    aria-label={`フォーム「${formItem.name}」を削除する`}
                  />
                </form>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
