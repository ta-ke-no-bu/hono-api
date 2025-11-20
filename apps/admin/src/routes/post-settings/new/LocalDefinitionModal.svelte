<script lang="ts">
  import ValidationConfig from '@lib/components/custom-fields/ValidationConfig.svelte';
  import DateConfig from '@lib/components/custom-fields/types/DateConfig.svelte';
  import FileConfig from '@lib/components/custom-fields/types/FileConfig.svelte';
  import GroupConfig from '@lib/components/custom-fields/types/GroupConfig.svelte';
  import RichTextConfig from '@lib/components/custom-fields/types/RichTextConfig.svelte';
  import SelectConfig from '@lib/components/custom-fields/types/SelectConfig.svelte';
  import TextConfig from '@lib/components/custom-fields/types/TextConfig.svelte';
  import type { CustomFieldType } from '@lib/types';
  import { createEventDispatcher } from 'svelte';
  import type { LocalDefinition } from './definition-helpers';

  export let open = false;
  export let mode: 'create' | 'edit' = 'create';
  export let definition: LocalDefinition | null = null;
  export let parentCandidateId: string | null = null;
  export let parentLabel: string | null = null;
  export let sessionKey = 0;

  const fieldTypes: CustomFieldType[] = ['text', 'richText', 'date', 'file', 'select', 'checkbox', 'group'];
  const dispatch = createEventDispatcher<{ save: { definition: LocalDefinition }; cancel: undefined }>();

  let label = '';
  let slug = '';
  let description = '';
  let type: CustomFieldType | '' = '';
  let isRepeatable = false;
  let validation: Record<string, unknown> = {};
  let config: Record<string, unknown> = {};
  let errorMessage = '';

  function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  type MutableConfig = Record<string, unknown> & {
    options?: unknown;
    maxSelections?: unknown;
    accept?: unknown;
    maxSize?: unknown;
    multiline?: unknown;
    toolbarPreset?: unknown;
    itemDefinition?: unknown;
    children?: unknown;
  };

  const coerceConfigForType = (fieldType: string, base: MutableConfig): MutableConfig => {
    let working: MutableConfig = base;
    let mutated = false;

    const ensureClone = () => {
      if (!mutated) {
        working = { ...working };
        mutated = true;
      }
    };

    const ensureArrayKey = (key: keyof MutableConfig) => {
      const value = working[key];
      if (!Array.isArray(value)) {
        ensureClone();
        working[key] = [];
      }
    };

    const removeKey = (key: keyof MutableConfig) => {
      if (key in working) {
        ensureClone();
        delete working[key];
      }
    };

    if (fieldType === 'select' || fieldType === 'checkbox') {
      ensureArrayKey('options');
      if (fieldType !== 'checkbox') {
        removeKey('maxSelections');
      }
    } else {
      removeKey('options');
      removeKey('maxSelections');
    }

    removeKey('children');

    if (fieldType === 'file') {
      ensureArrayKey('accept');
      if (working.maxSize !== undefined && typeof working.maxSize !== 'number') {
        ensureClone();
        working.maxSize = undefined;
      }
    } else {
      removeKey('accept');
      removeKey('maxSize');
    }

    if (fieldType === 'text') {
      if (working.multiline !== undefined && typeof working.multiline !== 'boolean') {
        ensureClone();
        working.multiline = Boolean(working.multiline);
      }
    } else {
      removeKey('multiline');
    }

    if (fieldType === 'richText') {
      if (working.toolbarPreset !== undefined && typeof working.toolbarPreset !== 'string') {
        ensureClone();
        working.toolbarPreset = 'basic';
      }
    } else {
      removeKey('toolbarPreset');
    }

    return working;
  };

  let lastSessionKey = -1;
  let lastDefinition: LocalDefinition | null = null;

  const initialize = () => {
    if (definition) {
      label = definition.label;
      slug = definition.slug;
      description = definition.description ?? '';
      type = definition.type;
      isRepeatable = definition.isRepeatable ?? false;
      validation = definition.validation ? cloneJson(definition.validation) : {};
      config = definition.config ? cloneJson(definition.config) : {};
    } else {
      label = '';
      slug = '';
      description = '';
      type = '';
      isRepeatable = false;
      validation = {};
      config = {};
    }
    errorMessage = '';
  };

  $: if (open && (sessionKey !== lastSessionKey || definition !== lastDefinition)) {
    initialize();
    lastSessionKey = sessionKey;
    lastDefinition = definition;
  }

  $: if (type) {
    config = coerceConfigForType(type, config as MutableConfig);
  }

  function close() {
    dispatch('cancel');
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedLabel || !trimmedSlug || !type) {
      errorMessage = '種別・スラッグ・ラベルは必須です。';
      return;
    }
    const nextValidation = validation && Object.keys(validation).length > 0 ? cloneJson(validation) : null;
    const nextConfig = config && Object.keys(config).length > 0 ? cloneJson(config) : null;

    const base: LocalDefinition = {
      id:
        definition?.id ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `tmp-${Math.random().toString(36).slice(2, 12)}`),
      parentId: definition?.parentId ?? parentCandidateId ?? null,
      type,
      slug: trimmedSlug,
      label: trimmedLabel,
      description: description.trim() ? description.trim() : null,
      isRepeatable: type === 'group' ? isRepeatable : false,
      order: definition?.order ?? 0,
      validation: nextValidation,
      config: nextConfig,
      children: definition?.children ? cloneJson(definition.children) : [],
    };

    dispatch('save', { definition: base });
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
    <div class="w-full max-w-2xl rounded-lg bg-white shadow-xl">
      <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 class="text-lg font-semibold text-gray-900">
          {mode === 'edit' ? 'フィールドを編集' : 'フィールドを追加'}
        </h2>
        <button
          type="button"
          class="rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onclick={close}
          aria-label="閉じる"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 8.586l4.95-4.95a1 1 0 111.414 1.414L11.414 10l4.95 4.95a1 1 0 11-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 11-1.414-1.414L8.586 10l-4.95-4.95A1 1 0 115.05 3.636L10 8.586z"
              clip-rule="evenodd"
            ></path>
          </svg>
        </button>
      </div>
      <form class="space-y-4 px-6 py-6" onsubmit={handleSubmit}>
        {#if parentLabel}
          <div>
            <span class="text-xs font-medium text-gray-500">親フィールド</span>
            <p class="mt-1 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
              {parentLabel}
            </p>
          </div>
        {/if}

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label for="modal-label" class="mb-1 block text-sm font-medium text-gray-700">ラベル *</label>
            <input
              id="modal-label"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              bind:value={label}
              required
              placeholder="例: タイトル"
            />
          </div>
          <div>
            <label for="modal-slug" class="mb-1 block text-sm font-medium text-gray-700">スラッグ *</label>
            <input
              id="modal-slug"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              bind:value={slug}
              required
              pattern="[a-z0-9\-]+"
              placeholder="例: title"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label for="modal-type" class="mb-1 block text-sm font-medium text-gray-700">種別 *</label>
            <select
              id="modal-type"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              bind:value={type}
              required
            >
              <option value="">選択してください</option>
              {#each fieldTypes as fieldType}
                <option value={fieldType}>{fieldType}</option>
              {/each}
            </select>
          </div>
          {#if type === 'group'}
            <div class="flex items-center">
              <input
                id="repeatable-toggle"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                bind:checked={isRepeatable}
              />
              <label for="repeatable-toggle" class="ml-2 text-sm text-gray-900">繰り返しを許可する</label>
            </div>
          {/if}
        </div>

        <div>
          <label for="modal-description" class="mb-1 block text-sm font-medium text-gray-700">説明</label>
          <textarea
            id="modal-description"
            rows="2"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            bind:value={description}
            placeholder="このフィールドの説明"
          ></textarea>
        </div>

        <div class="space-y-4">
          {#if type === 'text'}
            <TextConfig bind:config />
          {:else if type === 'select' || type === 'checkbox'}
            <SelectConfig bind:config />
          {:else if type === 'date'}
            <DateConfig bind:config />
          {:else if type === 'file'}
            <FileConfig bind:config />
          {:else if type === 'richText'}
            <RichTextConfig bind:config />
          {:else if type === 'group'}
            <GroupConfig bind:config />
          {/if}
          <ValidationConfig bind:validation fieldType={type || 'text'} />
        </div>

        {#if errorMessage}
          <p class="text-sm text-red-600">{errorMessage}</p>
        {/if}

        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            onclick={close}
          >
            キャンセル
          </button>
          <button
            type="submit"
            class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {mode === 'edit' ? '更新する' : '追加する'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
