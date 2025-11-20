<script lang="ts">
  import type { ActionData, PageData } from './$types';

  const { data, form } = $props<{ data: PageData; form: ActionData | null }>();

  const existingValues = data.mailSettings;
  const isMissing = data.missing;
  const fieldErrors = form?.errors ?? {};
  const submittedValues = (form?.values ?? {}) as { adminEmail?: string; fromEmail?: string };

  const adminEmailValue = (submittedValues.adminEmail as string | undefined) ?? existingValues.adminEmail;
  const fromEmailValue = (submittedValues.fromEmail as string | undefined) ?? existingValues.fromEmail;
</script>

<div class="p-8 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">メール設定</h1>
      <p class="text-sm text-gray-500 mt-1">通知先メールアドレスと送信元メールアドレスを更新できます。</p>
    </div>
  </div>

  {#if data.updated}
    <div class="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">メール設定を更新しました。</div>
  {/if}

  {#if isMissing && !data.updated}
    <div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-700">
      メール通知設定が未登録です。必要なアドレスを入力して保存してください。
    </div>
  {/if}

  {#if form?.message}
    <div class="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
      {form.message}
    </div>
  {/if}

  <form method="POST" class="space-y-6">
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700" for="adminEmail">管理者メールアドレス</label>
      <small class="md:col-span-2">全フォーム共通のデフォルト通知先</small>
      <input
        id="adminEmail"
        name="adminEmail"
        type="email"
        required
        value={adminEmailValue}
        class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        autocomplete="email"
      />
      {#if fieldErrors.adminEmail}
        <p class="text-sm text-red-600">{fieldErrors.adminEmail[0]}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700" for="fromEmail">送信元メールアドレス</label>
      <small class="md:col-span-2"
        >Resend 経由で送るすべてのメール（管理者向け・自動返信の両方）の From に使われるアドレス</small
      >
      <input
        id="fromEmail"
        name="fromEmail"
        type="email"
        required
        value={fromEmailValue}
        class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        autocomplete="email"
      />
      {#if fieldErrors.fromEmail}
        <p class="text-sm text-red-600">{fieldErrors.fromEmail[0]}</p>
      {/if}
    </div>

    <div class="flex justify-end gap-3">
      <a
        href="/contact"
        class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        問い合わせ一覧へ戻る
      </a>
      <button
        type="submit"
        class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        保存する
      </button>
    </div>
  </form>
</div>
