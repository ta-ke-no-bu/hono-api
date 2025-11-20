<script lang="ts">
  import { page } from '$app/stores';
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
  import { mergeWithDefaults, prepareCustomFieldsPayload } from '@lib/custom-fields/valueHelpers';
  import type { CustomFieldDefinition, PostSettingSummary, PostStatus } from '@lib/types';
  import { normalizeOptionalRichText, normalizeSpanColorAttributes } from '@lib/utils/normalizeRichTextColor';
  import { slugToCamelCase } from '@repo/utils';
  import type { ComponentType } from 'svelte';
  import { onDestroy, onMount, setContext } from 'svelte';
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();
  const pageStore = page;

  const DETAIL_SLUG_REGEX = /^[a-z0-9-]+$/;

  type CategorySummary = PageData['categories'][number];

  const isBrowser = typeof window !== 'undefined';

  const categories: CategorySummary[] = Array.isArray(data.categories) ? data.categories : [];
  const postSettings: PostSettingSummary[] = Array.isArray(data.postSettings) ? data.postSettings : [];
  const selectedPostSettingRaw = (data.selectedPostSetting ?? null) as PostSettingSummary | null;

  const statusOptions: Array<{ value: PostStatus; label: string }> = [
    { value: 'DRAFT', label: '下書き' },
    { value: 'PUBLISHED', label: '公開' },
    { value: 'ARCHIVED', label: 'アーカイブ' },
  ];

  const isValidStatus = (value: unknown): value is PostStatus =>
    value === 'DRAFT' || value === 'PUBLISHED' || value === 'ARCHIVED';

  type UpdateActionState = {
    success?: boolean;
    action?: string;
    message?: string;
    fields?: {
      title?: string;
      categoryId?: string;
      publishedAt?: string;
      postedAt?: string;
      status?: PostStatus;
      detailBody?: string;
      detailEnabled?: boolean;
      detailSlug?: string;
      postSettingId?: string;
      customFields?: unknown;
    };
  } | null;

  const actionState = $derived<UpdateActionState>(() => $pageStore.form as UpdateActionState);

  const toDateInputFormat = (isoString: string | null | undefined) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

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
    console.warn(`[post-edit] ${label}`, payload);
  }

  let title = $state(data.post.title);
  let categoryId = $state(data.post.categoryId ?? '');
  let publishedAt = $state(toDateInputFormat(data.post.publishedAt));
  let postedAt = $state(toDateInputFormat(data.post.postedAt));
  let detailBody = $state(normalizeOptionalRichText(data.post.detailBody ?? ''));
  let detailEnabled = $state(data.post.detailEnabled);
  let detailSlug = $state(data.post.detailSlug ?? '');
  let selectedPostSettingId = $state(data.post.postSettingId);
  const initialCustomFields = createDisplaySnapshot(parseCustomFieldsInitial(data.post.customFields));
  let customFields = $state.raw<Record<string, unknown>>(initialCustomFields);
  let showCustomFieldsJson = $state(false);
  let status = $state<PostStatus>((data.post.status as PostStatus | undefined) ?? 'DRAFT');

  const detailBodySnapshot = $derived(() =>
    detailBody && detailBody.length > 0 ? ({ html: detailBody, json: null } satisfies RichTextValue) : null,
  );

  const handleDetailBodyChange = (event: CustomEvent<RichTextValue>) => {
    const next = toPlain(event.detail ?? null);
    detailBody = typeof next?.html === 'string' ? normalizeSpanColorAttributes(next.html) : '';
  };

  const customFieldsSnapshot = $derived(createDisplaySnapshot(customFields));

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

  const normalizeSetting = (setting: PostSettingSummary | null | undefined) =>
    setting
      ? {
          ...setting,
          definitions: normalizeDefinitions(setting.definitions as CustomFieldDefinition[] | undefined),
        }
      : null;

  type NormalizedPostSetting = NonNullable<ReturnType<typeof normalizeSetting>>;

  let normalizedPostSettings = $state<NormalizedPostSetting[]>([]);
  let normalizedSelectedPostSetting = $state<NormalizedPostSetting | null>(null);
  let selectedPostSetting = $state<NormalizedPostSetting | null>(null);
  let selectedCustomFieldDefinitions = $state<CustomFieldDefinition[]>([]);

  $effect(() => {
    const normalized = Array.isArray(postSettings)
      ? (postSettings
          .map((setting) => normalizeSetting(setting))
          .filter((setting): setting is NormalizedPostSetting => Boolean(setting)) as NormalizedPostSetting[])
      : [];
    normalizedPostSettings = normalized;
  });

  $effect(() => {
    normalizedSelectedPostSetting = normalizeSetting(selectedPostSettingRaw);
  });

  $effect(() => {
    if (!selectedPostSettingId) {
      selectedPostSetting = null;
      return;
    }

    if (normalizedSelectedPostSetting && normalizedSelectedPostSetting.id === selectedPostSettingId) {
      selectedPostSetting = normalizedSelectedPostSetting;
      return;
    }

    const fallback = normalizedPostSettings.find((set) => set.id === selectedPostSettingId) ?? null;

    if (fallback && (!fallback.definitions || fallback.definitions.length === 0) && normalizedSelectedPostSetting) {
      selectedPostSetting = normalizedSelectedPostSetting;
      return;
    }

    selectedPostSetting = fallback ?? null;
  });

  $effect(() => {
    const definitions =
      Array.isArray(selectedPostSetting?.definitions) && selectedPostSetting?.definitions
        ? normalizeDefinitions(selectedPostSetting.definitions as CustomFieldDefinition[])
        : [];
    selectedCustomFieldDefinitions = definitions;
  });

  let detailSlugError = $state<string | null>(null);

  $effect(() => {
    if (!detailEnabled) {
      detailSlugError = null;
      return;
    }
    const trimmed = detailSlug.trim();
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

  const serializedCustomFields = $derived(
    selectedPostSettingId ? JSON.stringify(customFieldsSnapshot ?? {}, null, 2) : '',
  );

  const computeHiddenCustomFieldsValue = () => {
    if (!selectedPostSettingId) {
      return '';
    }
    try {
      return JSON.stringify(normalizeCustomFieldsForSubmit(customFieldsSnapshot));
    } catch {
      return JSON.stringify(customFieldsSnapshot ?? {});
    }
  };

  const hiddenCustomFieldsValue = $derived(computeHiddenCustomFieldsValue());

  let postedAtError = $state<string | null>(null);
  let publishedAtError = $state<string | null>(null);
  let publishedAtRequirementWarning = $state<string | null>(null);
  let isSubmitDisabled = $state(false);

  let defaultsAppliedForSetting = $state<string | null>(null);

  $effect(() => {
    if (defaultsAppliedForSetting && defaultsAppliedForSetting !== selectedPostSettingId) {
      defaultsAppliedForSetting = null;
    }
  });

  $effect(() => {
    if (selectedCustomFieldDefinitions.length === 0) {
      return;
    }
    if (!selectedPostSettingId) {
      return;
    }
    if (defaultsAppliedForSetting === selectedPostSettingId) {
      return;
    }
    const before = createDisplaySnapshot(customFields ?? {});
    customFields = toPlain(mergeWithDefaults(selectedCustomFieldDefinitions, customFields));
    if (isBrowser) {
      const after = createDisplaySnapshot(customFields ?? {});
      logDev('[post-edit] merge customFields', { before, after });
    }
    defaultsAppliedForSetting = selectedPostSettingId;
  });

  $effect(() => {
    if (!isBrowser) {
      return;
    }
    const snapshotSelected = createDisplaySnapshot(selectedPostSetting ?? null);
    const snapshotRaw = createDisplaySnapshot(selectedPostSettingRaw ?? null);
    logDev('[post-edit] selectedPostSetting', {
      selectedPostSettingId,
      selectedPostSettingRaw: snapshotRaw,
      selectedPostSetting: snapshotSelected,
      definitionsCount: selectedCustomFieldDefinitions.length,
    });
  });

  $effect(() => {
    if (!isBrowser) {
      return;
    }
    const snapshotCustom = createDisplaySnapshot(customFields ?? {});
    logDev('[post-edit] customFields snapshot', snapshotCustom);
  });

  $effect(() => {
    if (actionState?.action === 'update' && !actionState.success && actionState.fields) {
      const fields = actionState.fields;
      if (typeof fields.title === 'string') {
        title = fields.title;
      }
      if (typeof fields.categoryId === 'string') {
        categoryId = fields.categoryId;
      }
      if (typeof fields.publishedAt === 'string') {
        publishedAt = fields.publishedAt;
      }
      if (typeof fields.postedAt === 'string') {
        postedAt = fields.postedAt;
      }
      if (isValidStatus(fields.status)) {
        status = fields.status;
      }
      if (typeof fields.detailBody === 'string') {
        detailBody = normalizeOptionalRichText(fields.detailBody);
      }
      if (fields.detailEnabled !== undefined) {
        detailEnabled = Boolean(fields.detailEnabled);
      }
      if (typeof fields.detailSlug === 'string') {
        detailSlug = fields.detailSlug;
      }
      if (typeof fields.postSettingId === 'string' && fields.postSettingId) {
        selectedPostSettingId = fields.postSettingId;
      }
      const parsed = parseCustomFieldsInitial(fields.customFields);
      if (Object.keys(parsed).length > 0) {
        customFields = toPlain(mergeWithDefaults(selectedCustomFieldDefinitions, parsed));
        defaultsAppliedForSetting = selectedPostSettingId;
      }
    }
  });

  onMount(() => {
    /* RichTextEditor handles its own lifecycle */
  });

  onDestroy(() => {
    /* no-op */
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

  $effect(() => {
    postedAtError =
      postedAt && !isParsableDateInput(postedAt)
        ? '投稿日はYYYY-MM-DD または YYYY-MM-DDTHH:mm 形式で入力してください。'
        : null;
  });

  $effect(() => {
    publishedAtError =
      publishedAt && !isParsableDateInput(publishedAt)
        ? '公開日はYYYY-MM-DD または YYYY-MM-DDTHH:mm 形式で入力してください。'
        : null;
  });

  $effect(() => {
    publishedAtRequirementWarning =
      status === 'PUBLISHED' && !publishedAt.trim() ? '公開状態にする場合は公開日を入力してください。' : null;
  });

  $effect(() => {
    isSubmitDisabled =
      !selectedPostSettingId ||
      Boolean(postedAtError) ||
      Boolean(publishedAtError) ||
      (status === 'PUBLISHED' && !publishedAt.trim()) ||
      Boolean(detailSlugError);
  });
</script>

<div class="p-8 space-y-8">
  <div>
    <h1 class="text-3xl font-bold mb-2">投稿の編集</h1>
    <p class="text-sm text-gray-600">投稿内容を編集します。</p>
  </div>

  <a
    href="/posts"
    class="inline-flex items-center rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
  >
    一覧に戻る
  </a>

  <section class="bg-white rounded-lg shadow p-6 space-y-6" aria-labelledby="post-update-heading">
    <div class="flex items-center justify-between">
      <h2 id="post-update-heading" class="text-xl font-semibold">投稿を編集</h2>
      {#if actionState?.action === 'update'}
        <p class={`text-sm ${actionState.success ? 'text-green-600' : 'text-red-600'}`}>
          {actionState.success ? '投稿を更新しました。' : (actionState.message ?? '投稿の更新に失敗しました。')}
        </p>
      {/if}
    </div>
    <form
      method="POST"
      action="?/update"
      enctype="multipart/form-data"
      class="space-y-4"
      onsubmit={(event) => {
        const form = event.currentTarget as HTMLFormElement;
        const hidden = form.querySelector('input[name="customFields"]') as HTMLInputElement | null;
        if (hidden && (!hidden.value || hidden.value === '{}' || hidden.value === 'null')) {
          const fallback = collectCustomFieldsFromForm(selectedCustomFieldDefinitions, new FormData(form));
          if (Object.keys(fallback).length > 0) {
            hidden.value = JSON.stringify(fallback);
          }
        }
      }}
    >
      <div class="flex flex-col gap-2">
        <label for="post-setting-id" class="text-sm font-medium text-gray-700">投稿設定</label>
        <select
          id="post-setting-id"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-100 post-setting-select"
          required
          bind:value={selectedPostSettingId}
          disabled
        >
          {#each normalizedPostSettings as set (set.id)}
            <option value={set.id}>{set.name}{set.status === 'INACTIVE' ? '（無効）' : ''}</option>
          {/each}
        </select>
        <input type="hidden" name="postSettingId" value={selectedPostSettingId} />
      </div>

      <div class="flex flex-col gap-2">
        <label for="title" class="text-sm font-medium text-gray-700">タイトル</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxlength="120"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          bind:value={title}
        />
      </div>
      <div class="flex flex-col gap-2">
        <label for="categoryId" class="text-sm font-medium text-gray-700">カテゴリ</label>
        <select
          id="categoryId"
          name="categoryId"
          class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          bind:value={categoryId}
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
          bind:value={status}
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
          bind:value={postedAt}
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
          bind:value={publishedAt}
          aria-invalid={publishedAtError ? 'true' : 'false'}
          aria-describedby="published-at-help"
        />
        <p id="published-at-help" class="text-xs text-gray-500">公開予定日に合わせて変更できます。</p>
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
        <input type="hidden" name="detailBody" value={JSON.stringify({ html: detailBody })} />
      </div>

      <label class="inline-flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="detailEnabled"
          value="on"
          bind:checked={detailEnabled}
          class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>詳細ページを生成</span>
      </label>

      {#if detailEnabled}
        <div class="mt-3 space-y-2">
          <label for="detailSlugInput" class="text-sm font-medium text-gray-700">詳細ページ slug</label>
          <input
            id="detailSlugInput"
            name="detailSlug"
            type="text"
            class={`rounded-md border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${detailSlugError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
            bind:value={detailSlug}
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
                  const jsonCandidate = (nextValue as Record<string, unknown> | null | undefined)?.json;
                  logDev('[post-edit] custom field change', {
                    fieldKey,
                    hasHtml: typeof (nextValue as Record<string, unknown> | null | undefined)?.html === 'string',
                    hasJson: Boolean(jsonCandidate && typeof jsonCandidate === 'object'),
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
      {#if selectedPostSettingId}
        <input type="hidden" name="customFields" value={hiddenCustomFieldsValue} />
      {/if}

      <button
        type="submit"
        class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitDisabled}
      >
        投稿を更新
      </button>
    </form>
  </section>
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';

  .post-setting-select:disabled {
    appearance: none;
    -webkit-appearance: none;
    background-image: none;
    padding-right: 0.75rem;
  }
</style>
