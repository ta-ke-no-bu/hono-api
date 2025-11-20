<script lang="ts">
  import { page } from '$app/stores';
  import LocalDefinitionBuilder from './LocalDefinitionBuilder.svelte';
  import { normalizeOrders, toApiPayload, toLocalDefinitions } from './definition-helpers';
  import type { LocalDefinition } from './definition-helpers';

  const pageStore = page;

  type CreateActionState = {
    success?: boolean;
    action?: string;
    message?: string;
    fields?: {
      name?: string;
      slug?: string;
      status?: string;
      description?: string;
      definitions?: string;
    };
  } | null;

  const actionState = $derived<CreateActionState>(() => $pageStore.form as CreateActionState);

  let name = $state('');
  let slug = $state('');
  let status = $state('ACTIVE');
  let description = $state('');
  let currentStep = $state(1);
  let stepWarning = $state<string | null>(null);
  let definitionWarning = $state<string | null>(null);
  let definitions = $state<LocalDefinition[]>([]);
  let definitionsJson = $state('[]');

  let lastActionRef: CreateActionState | null = null;

  $effect(() => {
    if (actionState !== lastActionRef) {
      lastActionRef = actionState;
      if (actionState?.action === 'create' && !actionState.success) {
        const fields = actionState.fields ?? {};
        if (typeof fields.name === 'string') {
          name = fields.name;
        }
        if (typeof fields.slug === 'string') {
          slug = fields.slug;
        }
        if (typeof fields.status === 'string') {
          status = fields.status;
        }
        if (typeof fields.description === 'string') {
          description = fields.description;
        }
        if (typeof fields.definitions === 'string') {
          try {
            const parsed = JSON.parse(fields.definitions);
            definitions = normalizeOrders(toLocalDefinitions(parsed));
            currentStep = 2;
            definitionWarning = actionState.message ?? null;
          } catch (error) {
            console.error('Failed to restore definitions from action state:', error);
            definitions = [];
          }
        }
      }
    }
  });

  $effect(() => {
    const payload = toApiPayload(normalizeOrders(definitions));
    definitionsJson = JSON.stringify(payload);
  });

  const handleBuilderChange = (event: CustomEvent<LocalDefinition[]>) => {
    definitions = event.detail;
    if (import.meta.env.DEV) {
      console.warn('[post-settings/new] builder change', {
        count: definitions.length,
        sample: definitions[0] ?? null,
      });
    }
  };

  const proceedToStep2 = () => {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedName || !trimmedSlug) {
      stepWarning = '名称とスラッグを入力してください。';
      currentStep = 1;
      return;
    }
    stepWarning = null;
    definitionWarning = null;
    currentStep = 2;
  };

  const validateDefinitionsForSubmit = (nodes: LocalDefinition[]): string | null => {
    const visit = (node: LocalDefinition): string | null => {
      if (node.type === 'group' && node.isRepeatable) {
        if (!node.children || node.children.length === 0) {
          return `繰り返しグループ「${node.label}」には子フィールドを1件追加してください。`;
        }
        if (node.children.length > 1) {
          return `繰り返しグループ「${node.label}」には子フィールドを1件のみ設定してください。`;
        }
      }

      if ((node.type === 'select' || node.type === 'checkbox') && node.config) {
        const options = Array.isArray((node.config as Record<string, unknown>).options)
          ? ((node.config as { options: unknown[] }).options as unknown[])
          : [];
        if (!options.length) {
          return `フィールド「${node.label}」の選択肢を1件以上登録してください。`;
        }
        const invalidOption = options.find((option) => {
          if (typeof option !== 'object' || option === null) {
            return true;
          }
          const { label: optLabel, value: optValue } = option as { label?: unknown; value?: unknown };
          return (
            typeof optLabel !== 'string' ||
            optLabel.trim().length === 0 ||
            typeof optValue !== 'string' ||
            optValue.trim().length === 0
          );
        });
        if (invalidOption) {
          return `フィールド「${node.label}」の選択肢に未入力または不正な値があります。`;
        }
      }

      if (node.children?.length) {
        for (const child of node.children) {
          const childError = visit(child);
          if (childError) {
            return childError;
          }
        }
      }
      return null;
    };

    for (const node of nodes) {
      const error = visit(node);
      if (error) {
        return error;
      }
    }
    return null;
  };

  const handleFormSubmit = (event: Event) => {
    if (currentStep === 1) {
      event.preventDefault();
      proceedToStep2();
      return;
    }

    if (import.meta.env.DEV) {
      console.warn('[post-settings/new] submit attempt', {
        definitionsJson,
        definitionsCount: definitions.length,
      });
    }

    const validationError = validateDefinitionsForSubmit(definitions);
    if (validationError) {
      event.preventDefault();
      currentStep = 2;
      definitionWarning = validationError;
      if (import.meta.env.DEV) {
        console.warn('[post-settings/new] client validation failed', validationError);
      }
      return;
    }

    definitionWarning = null;
  };

  const stepIndicatorClass = (step: number) => {
    if (step === currentStep) {
      return 'bg-indigo-600 text-white';
    }
    if (step < currentStep) {
      return 'bg-indigo-100 text-indigo-600';
    }
    return 'bg-gray-200 text-gray-600';
  };
</script>

<div class="space-y-8 p-8">
  <header class="space-y-2">
    <h1 class="text-3xl font-bold text-gray-900">新規投稿設定</h1>
    <p class="text-sm text-gray-600">基本情報とカスタムフィールド定義を設定し、投稿テンプレートを作成します。</p>
  </header>

  <a
    href="/post-settings"
    class="inline-flex items-center rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
  >
    一覧に戻る
  </a>

  <form method="POST" action="?/create" class="space-y-6 rounded-lg bg-white p-6 shadow" onsubmit={handleFormSubmit}>
    <input type="hidden" name="definitions" value={definitionsJson} />

    <div class="flex items-center gap-3 text-sm font-medium">
      <div class={`flex h-9 w-9 items-center justify-center rounded-full ${stepIndicatorClass(1)}`}>1</div>
      <span class={currentStep === 1 ? 'text-indigo-600' : 'text-gray-500'}>基本情報</span>
      <span class="text-gray-400">→</span>
      <div class={`flex h-9 w-9 items-center justify-center rounded-full ${stepIndicatorClass(2)}`}>2</div>
      <span class={currentStep === 2 ? 'text-indigo-600' : 'text-gray-500'}>カスタムフィールド定義</span>
    </div>

    {#if actionState?.action === 'create' && actionState.message}
      <div
        class={`rounded-md border px-4 py-3 text-sm ${actionState.success ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}
      >
        {actionState.message}
      </div>
    {/if}

    <section class={currentStep === 1 ? 'space-y-4' : 'hidden'}>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700" for="name">名称 *</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxlength="120"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="例: お知らせ"
          bind:value={name}
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700" for="slug">スラッグ *</label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          maxlength="64"
          pattern="^[a-z0-9\-]+$"
          inputmode="lowercase"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="例: news"
          bind:value={slug}
        />
        <p class="mt-1 text-xs text-gray-500">半角英数字とハイフンのみ利用できます。</p>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700" for="status">状態 *</label>
        <select
          id="status"
          name="status"
          required
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          bind:value={status}
        >
          <option value="ACTIVE">有効</option>
          <option value="INACTIVE">無効</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700" for="description">説明</label>
        <textarea
          id="description"
          name="description"
          rows="3"
          maxlength="500"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="この投稿設定がどのような投稿に使われるかの説明"
          bind:value={description}
        ></textarea>
      </div>
      {#if stepWarning}
        <p class="text-sm text-red-600">{stepWarning}</p>
      {/if}
      <div class="flex items-center justify-end gap-3 pt-2">
        <a
          href="/post-settings"
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          キャンセル
        </a>
        <button
          type="button"
          class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onclick={proceedToStep2}
        >
          次へ進む
        </button>
      </div>
    </section>

    <section class={currentStep === 2 ? 'space-y-4' : 'hidden'}>
      <div class="rounded-md border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
        作成する投稿設定に必要なカスタムフィールドを追加してください。グループフィールドを利用すると、階層化や繰り返し入力に対応できます。
      </div>
      <LocalDefinitionBuilder value={definitions} on:change={handleBuilderChange} />
      {#if definitionWarning}
        <p class="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{definitionWarning}</p>
      {/if}
      <div class="flex items-center justify-between text-sm text-gray-500">
        <span>定義数: {definitions.length}</span>
        <span>送信前にプレビューで確認してください。</span>
      </div>
      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onclick={() => (currentStep = 1)}
        >
          戻る
        </button>
        <button
          type="submit"
          class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          投稿設定を作成
        </button>
      </div>
    </section>
  </form>
</div>
