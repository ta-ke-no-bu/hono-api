<script lang="ts">
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData | null;

  // Reactive variables for form fields
  let label = data.definition.label;
  let slug = data.definition.slug;
  let description = data.definition.description ?? '';
  // Add other fields as needed
</script>

<div class="space-y-8 p-8">
  <header class="space-y-2">
    <h1 class="text-3xl font-bold">フィールド定義の編集</h1>
    <p class="text-sm text-gray-600">「{data.definition.label}」の情報を更新します。</p>
    <a href="/settings/custom-fields" class="text-sm text-indigo-600 hover:underline">&larr; 一覧に戻る</a>
  </header>

  {#if form?.message}
    <div
      class={`rounded-md border p-4 text-sm ${form.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}
    >
      {form.message}
    </div>
  {/if}

  <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
    <form method="POST" action="?/updateDefinition" class="space-y-4">
      <div>
        <label for="def-label" class="block text-sm font-medium text-gray-700">ラベル *</label>
        <input
          id="def-label"
          name="label"
          type="text"
          required
          bind:value={label}
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label for="def-slug" class="block text-sm font-medium text-gray-700">スラッグ *</label>
        <input
          id="def-slug"
          name="slug"
          type="text"
          required
          bind:value={slug}
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label for="def-description" class="block text-sm font-medium text-gray-700">説明</label>
        <textarea
          id="def-description"
          name="description"
          rows="3"
          bind:value={description}
          class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        ></textarea>
      </div>
      <!-- Add inputs for config, validation etc. as needed -->
      <div class="flex justify-end">
        <button
          type="submit"
          class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          更新する
        </button>
      </div>
    </form>
  </section>
</div>
