<script lang="ts">
  import { Button, Checkbox, Input, Textarea } from '@repo/ui';
  import type { ActionData, PageData } from './$types';

  const { data, form } = $props<{ data: PageData; form: ActionData | undefined }>();

  const autoReplyPlaceholder = '{{name}} 様 などのプレースホルダが使用できます';

  type FormState = {
    name: string;
    slug: string;
    description: string;
    successMessage: string;
    isActive: boolean;
    turnstileEnabled: boolean;
    autoReplySubject: string;
    autoReplyTemplate: string;
    sendAutoReply: boolean;
    replyToFieldSlug: string;
    adminNotificationSubject: string;
    adminNotificationTemplate: string;
    sendAdminNotification: boolean;
    notificationEmails: string;
  };

  const initializeState = (): FormState => ({
    name: data?.form?.name ?? '',
    slug: data?.form?.slug ?? '',
    description: data?.form?.description ?? '',
    successMessage: data?.form?.successMessage ?? '',
    isActive: data?.form?.isActive ?? false,
    turnstileEnabled: data?.form?.turnstileEnabled ?? false,
    autoReplySubject: data?.form?.autoReplySubject ?? '',
    autoReplyTemplate: data?.form?.autoReplyTemplate ?? '',
    sendAutoReply: data?.form?.sendAutoReply ?? false,
    replyToFieldSlug: data?.form?.replyToFieldSlug ?? '',
    adminNotificationSubject: data?.form?.adminNotificationSubject ?? '',
    adminNotificationTemplate: data?.form?.adminNotificationTemplate ?? '',
    sendAdminNotification: data?.form?.sendAdminNotification ?? false,
    notificationEmails: data?.form?.notificationEmails ?? '',
  });

  const formState = $state(initializeState());

  let isBasicInfoOpen = $state(true);
  let isAutoReplyOpen = $state(true);
  let isAdminNotificationOpen = $state(true);
</script>

<div class="p-8 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">フォーム編集</h1>
      <p class="text-sm text-gray-500 mt-1">フォームの基本情報と通知設定を管理します。</p>
    </div>
    <a
      href="/settings/contact/forms"
      class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      一覧に戻る
    </a>
  </div>

  {#if form?.message}
    <div class="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
      {form.message}
    </div>
  {/if}
  {#if form?.success}
    <div class="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">更新しました。</div>
  {/if}

  <form method="POST" class="space-y-10" action="?/save">
    <details class="bg-white shadow rounded-lg p-6 space-y-4" bind:open={isBasicInfoOpen}>
      <summary class="text-lg font-medium text-gray-900 flex items-center justify-between cursor-pointer">
        基本情報
        <svg
          class="w-5 h-5 transform transition-transform duration-200"
          class:rotate-180={isBasicInfoOpen}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </summary>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700">フォーム名</label>
          <Input
            id="name"
            name="name"
            type="text"
            bind:value={formState.name}
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>
        <div>
          <label for="slug" class="block text-sm font-medium text-gray-700">スラッグ</label>
          <Input
            id="slug"
            name="slug"
            type="text"
            bind:value={formState.slug}
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>
        <div class="md:col-span-2">
          <label for="description" class="block text-sm font-medium text-gray-700">説明</label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            bind:value={formState.description}
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          ></Textarea>
        </div>
        <div class="md:col-span-2">
          <label for="successMessage" class="block text-sm font-medium text-gray-700">完了メッセージ</label>
          <Textarea
            id="successMessage"
            name="successMessage"
            rows={3}
            bind:value={formState.successMessage}
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          ></Textarea>
          <small class="mt-1 text-sm text-gray-500">ユーザーがフォームを送信した後に表示されるメッセージ</small>
        </div>
        <div class="flex items-center space-x-6">
          <Checkbox id="isActive" name="isActive" bind:checked={formState.isActive} label="公開する" />
          <Checkbox
            id="turnstileEnabled"
            name="turnstileEnabled"
            bind:checked={formState.turnstileEnabled}
            label="スパム検証有効"
          />
        </div>
      </div>
    </details>

    <details class="bg-white shadow rounded-lg p-6 space-y-4" bind:open={isAutoReplyOpen}>
      <summary class="text-lg font-medium text-gray-900 flex items-center justify-between cursor-pointer">
        自動返信メール設定
        <svg
          class="w-5 h-5 transform transition-transform duration-200"
          class:rotate-180={isAutoReplyOpen}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </summary>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <small class="md:col-span-2">送信者に自動返信メールを送る場合は件名と本文を設定してください。</small>
        <div class="md:col-span-2">
          <label for="autoReplySubject" class="block text-sm font-medium text-gray-700">件名</label>
          <Input
            id="autoReplySubject"
            name="autoReplySubject"
            type="text"
            bind:value={formState.autoReplySubject}
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div class="md:col-span-2">
          <label for="autoReplyTemplate" class="block text-sm font-medium text-gray-700">本文</label>
          <Textarea
            id="autoReplyTemplate"
            name="autoReplyTemplate"
            rows={4}
            bind:value={formState.autoReplyTemplate}
            placeholder={autoReplyPlaceholder}
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          ></Textarea>
        </div>
        <div class="flex items-center">
          <Checkbox
            id="sendAutoReply"
            name="sendAutoReply"
            bind:checked={formState.sendAutoReply}
            label="自動返信メールを有効にする"
          />
        </div>
        <div class="md:col-span-2">
          <label for="replyToFieldSlug" class="block text-sm font-medium text-gray-700"
            >返信先フィールドのスラッグ</label
          >
          <Input
            id="replyToFieldSlug"
            name="replyToFieldSlug"
            type="text"
            bind:value={formState.replyToFieldSlug}
            placeholder="例: email"
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <small class="mt-1 text-sm text-gray-500">
            Web フロントで定義している送信者メールアドレス欄のスラッグを指定してください。
          </small>
        </div>
      </div>
    </details>

    <details class="bg-white shadow rounded-lg p-6 space-y-4" bind:open={isAdminNotificationOpen}>
      <summary class="text-lg font-medium text-gray-900 flex items-center justify-between cursor-pointer">
        受信通知メール設定
        <svg
          class="w-5 h-5 transform transition-transform duration-200"
          class:rotate-180={isAdminNotificationOpen}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </summary>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <small class="md:col-span-2">メッセージを受信した際に通知メールを受け取る場合は以下を設定してください。</small>
        <div class="md:col-span-2">
          <label for="adminNotificationSubject" class="block text-sm font-medium text-gray-700">件名</label>
          <Input
            id="adminNotificationSubject"
            name="adminNotificationSubject"
            type="text"
            bind:value={formState.adminNotificationSubject}
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div class="md:col-span-2">
          <label for="adminNotificationTemplate" class="block text-sm font-medium text-gray-700">本文</label>
          <Textarea
            id="adminNotificationTemplate"
            name="adminNotificationTemplate"
            rows={4}
            bind:value={formState.adminNotificationTemplate}
            placeholder={autoReplyPlaceholder}
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          ></Textarea>
        </div>
        <div class="md:col-span-2">
          <label for="notificationEmails" class="block text-sm font-medium text-gray-700"
            >通知を受け取るメールアドレス</label
          >
          <small class="md:col-span-2">フォーム固有の通知先リスト</small>
          <Textarea
            id="notificationEmails"
            name="notificationEmails"
            rows={5}
            bind:value={formState.notificationEmails}
            placeholder="複数のメールアドレスを指定できます。1行に1つのメールアドレスを入力してください。"
            customClass="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          ></Textarea>
        </div>
        <div class="flex items-center">
          <Checkbox
            id="sendAdminNotification"
            name="sendAdminNotification"
            bind:checked={formState.sendAdminNotification}
            label="受信通知メールを有効にする"
          />
        </div>
      </div>
    </details>

    <div class="flex justify-end">
      <Button label="保存する" variant="primary" type="submit" />
    </div>
  </form>
</div>
