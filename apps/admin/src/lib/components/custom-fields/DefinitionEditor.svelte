<script lang="ts">
  import { enhance } from '$app/forms';
  import type { CustomFieldDefinition, FieldType } from '@lib/types';
  import ValidationConfig from './ValidationConfig.svelte';
  import DateConfig from './types/DateConfig.svelte';
  import FileConfig from './types/FileConfig.svelte';
  import GroupConfig from './types/GroupConfig.svelte';
  import RichTextConfig from './types/RichTextConfig.svelte';
  import SelectConfig from './types/SelectConfig.svelte';
  import TextConfig from './types/TextConfig.svelte';

  type FieldTypeOption = { value: FieldType; label: string };

  export let definition: Partial<CustomFieldDefinition> | null | undefined;
  export let postSettingId: string;
  export let parentOptions: { id: string; label: string; depth: number }[] = [];
  export let fieldTypes: FieldTypeOption[] = [];
  export let sessionKey: number | undefined;
  export let initialParentId: string | null = null;
  export let onClose: (() => void) | undefined;

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

  export let definitionId: string | undefined;
  export let label = '';
  export let slug = '';
  export let description = '';
  export let type = '';
  export let parentId = '';
  export let isRepeatable = false;
  export let config: Record<string, unknown> = {};
  export let validation: Record<string, unknown> = {};

  let lastSessionKey: number | undefined;
  let lastDefinition: Partial<CustomFieldDefinition> | null | undefined;
  let lastInitialParentId: string | null = null;

  $: {
    const key = sessionKey ?? 0;
    const source = definition ?? null;
    if (key !== lastSessionKey || source !== lastDefinition || initialParentId !== lastInitialParentId) {
      lastSessionKey = key;
      lastDefinition = source;
      lastInitialParentId = initialParentId ?? null;
      definitionId = source?.id;
      label = source?.label ?? '';
      slug = source?.slug ?? '';
      description = source?.description ?? '';
      type = (source?.type as string | undefined) ?? '';
      parentId = source?.parentId ?? initialParentId ?? '';
      isRepeatable = source?.isRepeatable ?? false;
      config = source?.config ? structuredClone(source.config) : {};
      validation = source?.validation ? structuredClone(source.validation) : {};
    }
  }

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

  $: {
    const coerced = coerceConfigForType(type, config as MutableConfig);
    if (coerced !== config) {
      config = coerced;
    }
  }

  $: isNew = !definitionId;
  $: formAction = isNew ? '?/createDefinition' : '?/updateDefinition';
  $: configJson = JSON.stringify(config ?? null);
  $: shouldSendConfig = type !== 'group';
  $: validationJson = JSON.stringify(validation ?? null);
  $: if (type !== 'group' && isRepeatable) {
    isRepeatable = false;
  }
</script>

<form method="POST" action={formAction} use:enhance class="space-y-4">
  {#if !isNew}
    <input type="hidden" name="id" value={definitionId ?? ''} />
  {/if}
  <input type="hidden" name="postSettingId" value={postSettingId} />
  <input type="hidden" name="isRepeatable" value={isRepeatable ? 'true' : 'false'} />

  {#if shouldSendConfig}
    <input type="hidden" name="config" value={configJson} />
  {/if}
  <input type="hidden" name="validation" value={validationJson} />

  <!-- Basic Fields -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <label for="label" class="label">ラベル *</label>
      <input id="label" name="label" type="text" required class="input" bind:value={label} />
    </div>
    <div>
      <label for="slug" class="label">スラッグ *</label>
      <input
        id="slug"
        name="slug"
        type="text"
        required
        pattern="^[a-z0-9\-]+$"
        inputmode="text"
        class="input lowercase"
        bind:value={slug}
      />
    </div>
  </div>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <label for="type" class="label">種別 *</label>
      <select id="type" name="type" required class="input" bind:value={type}>
        <option value="">選択してください</option>
        {#each fieldTypes as fieldType}
          <option value={fieldType.value}>{fieldType.label}</option>
        {/each}
      </select>
    </div>
    <div>
      <label for="parentId" class="label">
        <span>親フィールド</span>
        <div class="help-tooltip-container">
          <span class="help-icon">ℹ️</span>
          <div class="tooltip">
            フィールドをグループ化するための設定です。「グループ」または「繰り返し」タイプのフィールドを親として選択すると、その子フィールドとして所属させることができます。
          </div>
        </div>
      </label>
      <select id="parentId" name="parentId" class="input" bind:value={parentId}>
        <option value="">トップレベル</option>
        {#each parentOptions as option}
          <option value={option.id}>{`${'— '.repeat(option.depth)}${option.label}`}</option>
        {/each}
      </select>
    </div>
  </div>
  {#if type === 'group'}
    <div class="flex items-center">
      <input
        id="isRepeatable"
        type="checkbox"
        class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        bind:checked={isRepeatable}
      />
      <label for="isRepeatable" class="ml-2 block text-sm text-gray-900">繰り返しを許可する</label>
    </div>
  {/if}
  <div>
    <label for="description" class="label">説明</label>
    <textarea id="description" name="description" rows="2" class="input" bind:value={description}></textarea>
  </div>

  <!-- Dynamic Config/Validation Forms -->
  <div class="mt-4 space-y-4">
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
    <ValidationConfig bind:validation fieldType={type} />
  </div>

  <div class="flex justify-end gap-3 pt-4">
    {#if typeof onClose === 'function'}
      <button type="button" class="btn-secondary" on:click={onClose}>キャンセル</button>
    {/if}
    <button type="submit" class="btn-primary">{isNew ? '作成する' : '更新する'}</button>
  </div>
</form>

<style>
  .label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .input {
    width: 100%;
    border-radius: 0.375rem;
    border: 1px solid #d1d5db;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    background-color: #ffffff;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .input:focus-visible {
    outline: 3px solid rgba(99, 102, 241, 0.35);
    outline-offset: 2px;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  }

  .lowercase {
    text-transform: lowercase;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    background-color: #4f46e5;
    border: none;
    color: #ffffff;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .btn-primary:hover {
    background-color: #4338ca;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    border: 1px solid #d1d5db;
    background-color: #ffffff;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
  }

  .btn-secondary:hover {
    background-color: #f9fafb;
    border-color: #cbd5f5;
  }

  .help-tooltip-container {
    position: relative;
    display: inline-block;
  }

  .help-icon {
    cursor: help;
    color: #6b7280; /* gray-500 */
  }

  .tooltip {
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.2s;
    position: absolute;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    width: 280px;
    background-color: #1f2937; /* gray-800 */
    color: #fff;
    text-align: center;
    border-radius: 6px;
    padding: 8px;
    z-index: 10;
    font-size: 0.75rem; /* 12px */
    line-height: 1.5;
    font-weight: normal;
  }

  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #1f2937 transparent transparent transparent;
  }

  .help-tooltip-container:hover .tooltip {
    visibility: visible;
    opacity: 1;
  }
</style>
