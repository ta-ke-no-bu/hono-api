<script lang="ts">
  import { page } from '$app/stores';
  import type { ComponentType } from 'svelte';
  import { onDestroy, onMount, setContext } from 'svelte';
  import toast from 'svelte-french-toast';
  import { derived } from 'svelte/store';

  import CheckboxInput from '@lib/components/custom-fields/inputs/CheckboxInput.svelte';
  import DateInput from '@lib/components/custom-fields/inputs/DateInput.svelte';
  import FileInput from '@lib/components/custom-fields/inputs/FileInput.svelte';
  import GroupInput from '@lib/components/custom-fields/inputs/GroupInput.svelte';
  import RepeatableGroupInput from '@lib/components/custom-fields/inputs/RepeatableGroupInput.svelte';
  import RichTextInput from '@lib/components/custom-fields/inputs/RichTextInput.svelte';
  import SelectInput from '@lib/components/custom-fields/inputs/SelectInput.svelte';
  import TextInput from '@lib/components/custom-fields/inputs/TextInput.svelte';
  import type { RichTextValue } from '@lib/custom-fields/RichTextEditor.svelte';
  import RichTextEditor from '@lib/custom-fields/RichTextEditor.svelte';
  import { createInitialValues, mergeWithDefaults, prepareCustomFieldsPayload } from '@lib/custom-fields/valueHelpers';
  import type { CustomFieldDefinition } from '@lib/types';
  import { normalizeOptionalRichText, normalizeSpanColorAttributes } from '@lib/utils/normalizeRichTextColor';
  import { slugToCamelCase } from '@repo/utils';
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();
  const pageStore = page;

  const DETAIL_SLUG_REGEX = /^[a-z0-9-]+$/;

  type CategorySummary = PageData['categories'][number];

  const categories: CategorySummary[] = Array.isArray(data.categories) ? data.categories : [];
  let selectedPostSetting = $state<PageData['postSetting'] | null>(data.postSetting ?? null);

  function toPlain<T>(input: T): T {
    if (input === undefined || input === null) {
      return input;
    }
    if (typeof input !== 'object') {
      return input;
    }
    try {
      return structuredClone(input);
    } catch {
      try {
        return JSON.parse(JSON.stringify(input)) as T;
      } catch {
        return input;
      }
    }
  }

  function createDisplaySnapshot<T>(input: T): T {
    return toPlain(input);
  }

  function logDev(label: string, payload: unknown) {
    if (typeof window === 'undefined' || !import.meta.env.DEV) {
      return;
    }
    console.warn(`[post-create] ${label}`, payload);
  }

  const normalizeDefinitions = (definitions: CustomFieldDefinition[] | undefined): CustomFieldDefinition[] => {
    if (!Array.isArray(definitions)) {
      return [];
    }
    return definitions.map((definition) => {
      const normalizedConfig = (() => {
        if (typeof definition.config === 'string') {
          try {
            return JSON.parse(definition.config) as Record<string, unknown>;
          } catch {
            return {};
          }
        }
        return (definition.config as Record<string, unknown>) ?? {};
      })();

      const normalizedValidation = (() => {
        if (typeof definition.validation === 'string') {
          try {
            return JSON.parse(definition.validation) as Record<string, unknown>;
          } catch {
            return {};
          }
        }
        return (definition.validation as Record<string, unknown>) ?? {};
      })();

      const children = normalizeDefinitions(definition.children as CustomFieldDefinition[] | undefined);

      return {
        ...definition,
        config: normalizedConfig,
        validation: normalizedValidation,
        children,
      } satisfies CustomFieldDefinition;
    });
  };

  const displayedDefinitions = $derived(
    normalizeDefinitions(selectedPostSetting?.definitions as CustomFieldDefinition[] | undefined),
  );
  const selectedCustomFieldDefinitions = $derived(displayedDefinitions);

  type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  type CreateActionState = {
    success?: boolean;
    action?: string;
    message?: string;
    fields?: {
      title?: string;
      categoryId?: string;
      publishedAt?: string;
      postedAt?: string;
      detailBody?: string;
      detailEnabled?: boolean;
      detailSlug?: string;
      postSettingId?: string;
      status?: PostStatus;
      customFields?: unknown;
    };
    postSetting?: PageData['postSetting'];
  } | null;

  const actionState = derived(pageStore, ($pageStore) => ($pageStore.form ?? null) as CreateActionState);

  $effect(() => {
    const currentAction = $actionState;
    if (currentAction?.postSetting) {
      selectedPostSetting = currentAction.postSetting;
      return;
    }
    if (data.postSetting) {
      selectedPostSetting = data.postSetting;
      return;
    }
    const rawPostSettingId =
      currentAction?.fields && typeof currentAction.fields.postSettingId === 'string'
        ? currentAction.fields.postSettingId.trim()
        : '';
    if (!rawPostSettingId) {
      selectedPostSetting = null;
    }
  });

  let selectedPostSettingIdValue = $state('');

  $effect(() => {
    if (selectedPostSetting) {
      selectedPostSettingIdValue = selectedPostSetting.id ?? '';
      return;
    }
    const currentAction = $actionState;
    if (currentAction?.fields && typeof currentAction.fields.postSettingId === 'string') {
      selectedPostSettingIdValue = currentAction.fields.postSettingId.trim();
      return;
    }
    selectedPostSettingIdValue = '';
  });

  const statusOptions: Array<{ value: PostStatus; label: string }> = [
    { value: 'DRAFT', label: '下書き' },
    { value: 'PUBLISHED', label: '公開' },
    { value: 'ARCHIVED', label: 'アーカイブ' },
  ];

  const todayDateText = () => new Date().toISOString().split('T')[0];

  const ensureString = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);

  const isValidStatus = (value: unknown): value is PostStatus =>
    value === 'DRAFT' || value === 'PUBLISHED' || value === 'ARCHIVED';

  const normalizeDateCandidate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    let candidate = trimmed.replace(' ', 'T');
    if (!candidate.includes('T')) {
      candidate = `${candidate}T00:00:00`;
    }
    return candidate;
  };

  const isParsableDateInput = (value: string) => {
    if (!value) {
      return true;
    }
    const candidate = normalizeDateCandidate(value);
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) === false;
  };

  let createTitle = $state('');
  let createCategoryId = $state('');
  let createPublishedAt = $state('');
  let createPostedAt = $state('');
  let createStatus = $state<PostStatus>('DRAFT');
  let createDetailBody = $state('');
  let createDetailEnabled = $state(false);
  let createDetailSlug = $state('');
  let customFields = $state.raw<Record<string, unknown>>({});
  let showCustomFieldsJson = $state(false);
  let isSubmitting = $state(false);
  let initialCustomFieldsAssigned = false;

  const customFieldsSnapshot = $derived(createDisplaySnapshot(customFields));

  const detailBodySnapshot = $derived(() =>
    createDetailBody && createDetailBody.length > 0
      ? ({ html: createDetailBody, json: null } satisfies RichTextValue)
      : null,
  );

  const handleDetailBodyChange = (event: CustomEvent<RichTextValue>) => {
    const nextValue = toPlain(event.detail ?? null);
    createDetailBody = typeof nextValue?.html === 'string' ? normalizeSpanColorAttributes(nextValue.html) : '';
  };

  const parseCustomFieldsInitial = (raw: unknown): Record<string, unknown> => {
    if (!raw) {
      return {};
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
  };

  const applyActionState = (state: CreateActionState, { initialize = false } = {}) => {
    if (!state) {
      if (initialize) {
        const fallbackDate = todayDateText();
        createPublishedAt = fallbackDate;
        createPostedAt = fallbackDate;
        createStatus = 'DRAFT';
      }
      return;
    }

    if (state.action !== 'create') {
      return;
    }

    if (state.success) {
      const fallbackDate = todayDateText();
      createTitle = '';
      createCategoryId = '';
      createPublishedAt = fallbackDate;
      createPostedAt = fallbackDate;
      createStatus = 'DRAFT';
      createDetailBody = '';
      createDetailEnabled = false;
      createDetailSlug = '';
      customFields = {};
      initialCustomFieldsAssigned = false;
      showCustomFieldsJson = false;
      return;
    }

    const fields = state.fields ?? {};
    const fallbackDate = todayDateText();
    createTitle = (fields.title as string) ?? '';
    createCategoryId = (fields.categoryId as string) ?? '';
    createPublishedAt = ensureString(fields.publishedAt, fallbackDate);
    createPostedAt = ensureString(fields.postedAt, fallbackDate);
    createStatus = isValidStatus(fields.status) ? fields.status : createStatus;
    createDetailBody = normalizeOptionalRichText((fields.detailBody as string) ?? '');
    createDetailEnabled = Boolean('detailEnabled' in fields ? fields.detailEnabled : false);
    createDetailSlug = (fields.detailSlug as string) ?? '';
    const parsedCustomFields = parseCustomFieldsInitial(fields.customFields);
    customFields = toPlain(parsedCustomFields);
    initialCustomFieldsAssigned = Object.keys(parsedCustomFields).length > 0;
  };

  let hasInitializedActionState = false;

  $effect(() => {
    const currentState = $actionState;
    applyActionState(currentState, { initialize: !hasInitializedActionState });
    if (!hasInitializedActionState) {
      hasInitializedActionState = true;
    }
    if (!currentState || currentState.action === 'create') {
      isSubmitting = false;
    }
  });

  let detailSlugError = $state<string | null>(null);
  let postedAtError = $state<string | null>(null);
  let publishedAtError = $state<string | null>(null);
  let publishedAtRequirementWarning = $state<string | null>(null);

  $effect(() => {
    if (!createDetailEnabled) {
      detailSlugError = null;
      return;
    }
    const trimmed = createDetailSlug.trim();
    if (!trimmed) {
      detailSlugError = 'slugを入力してください。';
      return;
    }
    if (!DETAIL_SLUG_REGEX.test(trimmed)) {
      detailSlugError = 'slugは半角英数字とハイフンのみ利用できます。';
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 120) {
      detailSlugError = 'slugは3文字以上120文字以内で入力してください。';
      return;
    }
    detailSlugError = null;
  });

  const normalizeCustomFieldsForSubmit = (fields: Record<string, unknown> | undefined) =>
    prepareCustomFieldsPayload(selectedCustomFieldDefinitions, fields);

  const serializedCustomFields = $derived(JSON.stringify(customFieldsSnapshot ?? {}, null, 2));
  const computeHiddenCustomFieldsValue = () => {
    try {
      const value = JSON.stringify(normalizeCustomFieldsForSubmit(customFieldsSnapshot));
      logDev('[post-new] hidden customFields', value);
      return value;
    } catch {
      const fallback = JSON.stringify(customFieldsSnapshot ?? {});
      logDev('[post-new] hidden customFields (fallback)', fallback);
      return fallback;
    }
  };

  const hiddenCustomFieldsValue = $derived(computeHiddenCustomFieldsValue());

  $effect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    logDev('[post-new] customFields snapshot', createDisplaySnapshot(customFields));
  });

  $effect(() => {
    if (selectedCustomFieldDefinitions.length === 0) {
      return;
    }
    if (initialCustomFieldsAssigned) {
      customFields = toPlain(mergeWithDefaults(selectedCustomFieldDefinitions, customFields));
      initialCustomFieldsAssigned = false;
    } else if (Object.keys(customFields).length === 0) {
      customFields = toPlain(createInitialValues(selectedCustomFieldDefinitions));
    }
  });

  $effect(() => {
    if (!createDetailEnabled) {
      createDetailSlug = '';
    }
  });

  $effect(() => {
    postedAtError =
      createPostedAt && !isParsableDateInput(createPostedAt)
        ? '投稿日はYYYY-MM-DD または YYYY-MM-DDTHH:mm 形式で入力してください。'
        : null;
  });

  $effect(() => {
    publishedAtError =
      createPublishedAt && !isParsableDateInput(createPublishedAt)
        ? '公開日はYYYY-MM-DD または YYYY-MM-DDTHH:mm 形式で入力してください。'
        : null;
  });

  $effect(() => {
    publishedAtRequirementWarning =
      createStatus === 'PUBLISHED' && !createPublishedAt.trim()
        ? '公開状態にする場合は公開日を入力してください。'
        : null;
  });

  const isSubmitDisabled = $derived(
    Boolean(postedAtError) ||
      Boolean(publishedAtError) ||
      (createStatus === 'PUBLISHED' && !createPublishedAt.trim()) ||
      isSubmitting,
  );

  onMount(() => {
    const message = sessionStorage.getItem('toastMessage');
    if (message) {
      toast.success(message);
      sessionStorage.removeItem('toastMessage');
    }
  });

  onDestroy(() => {
    /* RichTextEditor handles teardown internally */
  });

  const inputComponents: Record<string, ComponentType> = {
    text: TextInput,
    richText: RichTextInput,
    date: DateInput,
    file: FileInput,
    select: SelectInput,
    checkbox: CheckboxInput,
    group: GroupInput,
    repeatable: RepeatableGroupInput,
  };

  setContext('sessionToken', data.sessionToken);
  setContext('inputComponents', inputComponents);

  function collectCustomFieldsFromForm(definitions: CustomFieldDefinition[], formData: FormData) {
    const result: Record<string, unknown> = {};
    const visit = (defs: CustomFieldDefinition[]) => {
      for (const definition of defs) {
        const slug = definition.slug;
        const key = slugToCamelCase(slug);
        switch (definition.type) {
          case 'text':
          case 'date': {
            const value = formData.get(slug);
            if (typeof value === 'string' && value.trim().length > 0) {
              result[key] = value.trim();
            }
            break;
          }
          case 'select': {
            const value = formData.get(slug);
            if (typeof value === 'string' && value.trim().length > 0) {
              result[key] = value.trim();
            }
            break;
          }
          case 'checkbox': {
            const values = formData
              .getAll(slug)
              .map((item) => (typeof item === 'string' ? item.trim() : ''))
              .filter(Boolean);
            if (values.length > 0) {
              result[key] = values;
            }
            break;
          }
          default: {
            if (Array.isArray(definition.children) && definition.children.length > 0) {
              visit(definition.children as CustomFieldDefinition[]);
            }
            break;
          }
        }
      }
    };
    visit(definitions);
    return result;
  }
</script>

<div class="p-8 space-y-8">
  <div>
    <h1 class="text-3xl font-bold mb-2">新規投稿</h1>
    <p class="text-sm text-gray-600">投稿設定で定義された項目に沿って必要な情報を入力してください。</p>
  </div>

  <a
    href="/posts"
    class="inline-flex items-center rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
  >
    一覧に戻る
  </a>

  <section class="bg-white rounded-lg shadow p-6 space-y-6" aria-labelledby="post-create-heading">
    <div class="flex items-center justify-between">
      <h2 id="post-create-heading" class="text-xl font-semibold">投稿を作成</h2>
      {#if $actionState?.action === 'create'}
        <p class={`text-sm ${$actionState.success ? 'text-green-600' : 'text-red-600'}`}>
          {$actionState.success ? '投稿を作成しました。' : ($actionState.message ?? '投稿の作成に失敗しました。')}
        </p>
      {/if}
    </div>
    <form
      method="POST"
      action="?/create"
      enctype="multipart/form-data"
      class="space-y-4"
      onsubmit={(event) => {
        if (isSubmitting) {
          event.preventDefault();
          return;
        }
        const form = event.currentTarget as HTMLFormElement;
        const hidden = form.querySelector('input[name="customFields"]') as HTMLInputElement | null;
        if (hidden && (!hidden.value || hidden.value === '{}' || hidden.value === 'null')) {
          const fallback = collectCustomFieldsFromForm(selectedCustomFieldDefinitions, new FormData(form));
          if (Object.keys(fallback).length > 0) {
            hidden.value = JSON.stringify(fallback);
          }
        }
        isSubmitting = true;
      }}
    >
      {#if selectedPostSetting}
        <div class="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div class="font-medium text-slate-900">投稿設定: {selectedPostSetting.name}</div>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">slug: {selectedPostSetting.slug}</span
            >
            {#if selectedPostSetting.description}
              <span>{selectedPostSetting.description}</span>
            {/if}
          </div>
        </div>
      {:else}
        <div class="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <p class="font-medium">デフォルト投稿フォーム</p>
          <p class="mt-1">
            テンプレートを使用せずに投稿します。より詳細な項目を管理したい場合は、<a
              href="/post-settings"
              class="underline font-semibold">投稿設定</a
            >からテンプレートを作成してください。
          </p>
        </div>
      {/if}

      <input type="hidden" name="postSettingId" value={selectedPostSettingIdValue} />

      <div class="flex flex-col gap-2">
        <label for="title" class="text-sm font-medium text-gray-700">タイトル</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxlength="120"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="例: プロジェクトリリースのお知らせ"
          bind:value={createTitle}
        />
      </div>
      <div class="flex flex-col gap-2">
        <label for="categoryId" class="text-sm font-medium text-gray-700">カテゴリ</label>
        <select
          id="categoryId"
          name="categoryId"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          bind:value={createCategoryId}
        >
          <option value="">カテゴリを選択</option>
          {#each categories as category (category.id)}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
      </div>
      <div class="flex flex-col gap-2">
        <label for="status" class="text-sm font-medium text-gray-700">状態</label>
        <select
          id="status"
          name="status"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          bind:value={createStatus}
        >
          {#each statusOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <div class="flex flex-col gap-2">
        <label for="postedAt" class="text-sm font-medium text-gray-700">投稿日</label>
        <input
          id="postedAt"
          name="postedAt"
          type="text"
          class={`rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${postedAtError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500'}`}
          bind:value={createPostedAt}
          placeholder="例: 2025-10-21"
          autocomplete="off"
          aria-describedby="posted-at-help"
          aria-invalid={postedAtError ? 'true' : 'false'}
        />
        <p id="posted-at-help" class="text-xs text-gray-500">
          YYYY-MM-DD または YYYY-MM-DD HH:mm 形式で入力してください。
        </p>
        {#if postedAtError}
          <p class="text-xs text-red-600" role="alert">{postedAtError}</p>
        {/if}
      </div>
      <div class="flex flex-col gap-2">
        <label for="publishedAt" class="text-sm font-medium text-gray-700">公開日</label>
        <input
          id="publishedAt"
          name="publishedAt"
          type="date"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          bind:value={createPublishedAt}
          aria-invalid={publishedAtError ? 'true' : 'false'}
          aria-describedby="published-at-help"
        />
        <p id="published-at-help" class="text-xs text-gray-500">必要に応じて公開日を変更できます。</p>
        {#if publishedAtRequirementWarning}
          <p class="text-xs text-red-600" role="alert">{publishedAtRequirementWarning}</p>
        {/if}
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-gray-700">詳細本文</span>
        <RichTextEditor
          value={detailBodySnapshot()}
          placeholder="本文を入力してください…"
          toolbarPreset="standard"
          on:change={handleDetailBodyChange}
        />
        <input type="hidden" name="detailBody" value={createDetailBody} />
      </div>

      <label class="inline-flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="detailEnabled"
          value="on"
          bind:checked={createDetailEnabled}
          class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>詳細ページを生成</span>
      </label>

      {#if createDetailEnabled}
        <div class="mt-3 space-y-2">
          <label for="detailSlugInput" class="text-sm font-medium text-gray-700">詳細ページ slug</label>
          <input
            id="detailSlugInput"
            name="detailSlug"
            type="text"
            class={`rounded-md border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${detailSlugError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
            bind:value={createDetailSlug}
            pattern="^[a-z0-9\-]+$"
            inputmode="lowercase"
            aria-describedby="detail-slug-help"
            aria-invalid={detailSlugError ? 'true' : 'false'}
            placeholder="例: spring-update"
            autocomplete="off"
          />
          {#if detailSlugError}
            <p class="text-xs text-red-600" role="alert">{detailSlugError}</p>
          {/if}
          <p id="detail-slug-help" class="text-xs text-gray-500">slugは半角英数字とハイフンのみ利用できます。</p>
        </div>
      {/if}

      {#if selectedPostSetting && selectedPostSetting.definitions && selectedPostSetting.definitions.length > 0}
        <div class="space-y-3 border border-dashed border-gray-300 rounded-lg p-4 bg-slate-50">
          <div class="flex items-start justify-between gap-4">
            <h3 class="text-sm font-semibold text-gray-700">カスタムフィールド</h3>
            <button
              type="button"
              class="text-xs text-indigo-600 hover:text-indigo-500 underline"
              onclick={() => (showCustomFieldsJson = !showCustomFieldsJson)}
            >
              {showCustomFieldsJson ? 'プレビューを隠す' : 'JSONプレビューを表示'}
            </button>
          </div>
          {#each selectedCustomFieldDefinitions as definition (definition.id)}
            {@const fieldKey = slugToCamelCase(definition.slug)}
            {@const fieldValue = customFieldsSnapshot?.[fieldKey]}
            {#if (definition.type === 'group' && definition.isRepeatable) || definition.type === 'repeatable'}
              <RepeatableGroupInput
                {definition}
                value={createDisplaySnapshot(fieldValue) as Record<string, unknown>[]}
                on:change={(event) => {
                  customFields = toPlain({
                    ...customFields,
                    [fieldKey]: toPlain(event.detail),
                  });
                }}
              />
            {:else if inputComponents[definition.type]}
              {@const DynamicComponent = inputComponents[definition.type]}
              <DynamicComponent
                {definition}
                value={createDisplaySnapshot(fieldValue)}
                on:change={(event) => {
                  const rawNextValue = event.detail !== undefined ? event.detail : event.target?.value;
                  const nextValue = toPlain(rawNextValue);
                  customFields = toPlain({
                    ...customFields,
                    [fieldKey]: nextValue,
                  });
                  const candidate = (nextValue as Record<string, unknown> | null | undefined)?.json;
                  logDev('[post-new] custom field change', {
                    fieldKey,
                    hasHtml: typeof (nextValue as Record<string, unknown> | null | undefined)?.html === 'string',
                    hasJson: Boolean(candidate && typeof candidate === 'object'),
                  });
                }}
              />
            {:else}
              <p class="text-red-500">未対応のフィールドタイプ: {definition.type}</p>
            {/if}
          {/each}
          {#if showCustomFieldsJson}
            <pre
              class="bg-white border border-gray-200 rounded-md p-3 text-xs text-gray-700 overflow-x-auto">{serializedCustomFields}</pre>
          {/if}
        </div>
      {/if}
      <input type="hidden" name="customFields" value={hiddenCustomFieldsValue} />

      <button
        type="submit"
        disabled={isSubmitDisabled}
        class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        投稿を作成
      </button>
    </form>
  </section>
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';
</style>
