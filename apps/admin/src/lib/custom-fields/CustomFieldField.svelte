<svelte:options runes={false} />
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FileInput from './FileInput.svelte';
  import RichTextEditor from './RichTextEditor.svelte';
  import type { ChangeValueDetail, CustomFieldDefinition, FileValue, RichTextValue } from './types';

  type CheckboxOption = {
    label: string;
    value: string;
  };

  export let definition: CustomFieldDefinition;
  export let value: unknown;
  export let path: string[] = [];

  const dispatch = createEventDispatcher<{ changeValue: ChangeValueDetail }>();

  const slugToCamelCase = (slug: string) =>
    slug
      .split(/[-_\s]+/)
      .map((segment, index) => {
        if (index === 0) {
          return segment.toLowerCase();
        }
        return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      })
      .join('');

  let fieldValue: unknown = value;
  $: fieldValue = value;

  $: fieldKey = slugToCamelCase(definition.slug);
  $: fieldPath = [...path, fieldKey];
  $: fieldId = fieldPath.join('__');
  $: descriptionId = definition.description ? `${fieldId}-description` : undefined;

  $: validation = (definition.validation ?? {}) as Record<string, unknown>;
  $: config = (definition.config ?? {}) as Record<string, unknown>;

  $: isRequired = Boolean(validation.required);
  $: minItems = typeof validation.minItems === 'number' ? (validation.minItems as number) : undefined;
  $: maxItems = typeof validation.maxItems === 'number' ? (validation.maxItems as number) : undefined;
  $: labelText = `${definition.label}${isRequired ? ' *' : ''}`;

  const onChange = (newValue: unknown) => {
    fieldValue = newValue;
    dispatch('changeValue', { key: fieldKey, value: newValue });
  };

  const asString = (input: unknown): string => (typeof input === 'string' ? input : '');

  const asRichTextValue = (input: unknown): RichTextValue => {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      return input as RichTextValue;
    }
    return null;
  };

  const asFileValue = (input: unknown): FileValue => {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      return input as FileValue;
    }
    return null;
  };

  const mergeOption = (option: CheckboxOption): CheckboxOption => ({
    label: option.label.trim(),
    value: option.value.trim(),
  });

  const currentOptionValues = () => {
    if (!Array.isArray(fieldValue)) {
      return new Set<string>();
    }
    const collected: string[] = [];
    for (const item of fieldValue as CheckboxOption[]) {
      if (item && typeof item.value === 'string' && item.value.length > 0) {
        collected.push(item.value);
      }
    }
    return new Set(collected);
  };

  let selectValue = '';
  $: options = Array.isArray(config.options) ? (config.options as CheckboxOption[]) : [];
  $: checkboxValues = currentOptionValues();

  $: if (definition.type === 'select') {
    let current = '';
    if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
      const candidate = (fieldValue as { value?: string }).value;
      current = typeof candidate === 'string' ? candidate : '';
    } else if (typeof fieldValue === 'string') {
      current = fieldValue;
    }
    if (selectValue !== current) {
      selectValue = current;
    }
  }

  const handleCheckboxChange = (option: CheckboxOption, checked: boolean) => {
    const normalized = mergeOption(option);
    const base = Array.isArray(fieldValue) ? [...(fieldValue as CheckboxOption[])] : [];
    let next = base.filter((item): item is CheckboxOption => Boolean(item));
    if (checked) {
      if (!next.find((item) => item.value === normalized.value)) {
        next.push(normalized);
      }
    } else {
      next = next.filter((item) => item.value !== normalized.value);
    }
    onChange(next);
  };

  const getConfigString = (key: string, fallback = ''): string => {
    const raw = config[key];
    return typeof raw === 'string' ? raw : fallback;
  };

  const handleSelectChange = (event: Event) => {
    const select = event.target as HTMLSelectElement;
    const selectedValue = select.value;
    selectValue = selectedValue;
    const option = options.find((opt) => opt.value === selectedValue);
    if (!option) {
      onChange(null);
      return;
    }
    onChange(mergeOption(option));
  };

  const handleTextChange = (event: Event) => {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    onChange(input.value);
  };

  const handleDateChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    onChange(input.value);
  };

  const ensureGroupObject = () => {
    if (!fieldValue || typeof fieldValue !== 'object' || Array.isArray(fieldValue)) {
      onChange({});
    }
  };

  const ensureRepeatableArray = () => {
    if (!Array.isArray(fieldValue)) {
      onChange([]);
    }
  };

  const addRepeatableItem = () => {
    ensureRepeatableArray();
    const base = Array.isArray(fieldValue) ? [...(fieldValue as unknown[])] : [];
    base.push({});
    onChange(base);
  };

  const removeRepeatableItem = (index: number) => {
    if (!Array.isArray(fieldValue)) {
      return;
    }
    const base = (fieldValue as unknown[]).filter((_, idx) => idx !== index);
    onChange(base);
  };

  const updateRepeatableItem = (index: number, nextValue: unknown) => {
    const base = Array.isArray(fieldValue) ? [...(fieldValue as unknown[])] : [];
    base[index] = nextValue;
    onChange(base);
  };
</script>

<div class="custom-field-node" data-field={fieldPath.join('.')}>
  {#if definition.type === 'text'}
    <label class="custom-field-label" for={fieldId}>
      <span>{labelText}</span>
      {#if definition.description}
        <span id={descriptionId} class="custom-field-description">{definition.description}</span>
      {/if}
    </label>
    {#if config.multiline ?? false}
      <textarea
        id={fieldId}
        class="custom-field-textarea"
        rows={4}
        aria-describedby={descriptionId ?? undefined}
        on:input={handleTextChange}>{asString(fieldValue)}</textarea
      >
    {:else}
      <input
        id={fieldId}
        class="custom-field-input"
        type="text"
        value={asString(fieldValue)}
        aria-describedby={descriptionId ?? undefined}
        on:input={handleTextChange}
      />
    {/if}
  {:else if definition.type === 'date'}
    <label class="custom-field-label" for={fieldId}>
      <span>{labelText}</span>
      {#if definition.description}
        <span id={descriptionId} class="custom-field-description">{definition.description}</span>
      {/if}
    </label>
    <input
      id={fieldId}
      class="custom-field-input"
      type={config.mode === 'date' ? 'date' : 'datetime-local'}
      value={asString(fieldValue)}
      aria-describedby={descriptionId ?? undefined}
      on:input={handleDateChange}
    />
  {:else if definition.type === 'richText'}
    <label class="custom-field-label" for={fieldId}>
      <span>{labelText}</span>
      {#if definition.description}
        <span id={descriptionId} class="custom-field-description">{definition.description}</span>
      {/if}
    </label>
    <RichTextEditor
      value={asRichTextValue(fieldValue)}
      placeholder={getConfigString('placeholder')}
      on:change={(e) => onChange(e.detail)}
    />
  {:else if definition.type === 'select'}
    <label class="custom-field-label" for={fieldId}>
      <span>{labelText}</span>
      {#if definition.description}
        <span id={descriptionId} class="custom-field-description">{definition.description}</span>
      {/if}
    </label>
    <select
      id={fieldId}
      class="custom-field-input"
      bind:value={selectValue}
      aria-describedby={descriptionId ?? undefined}
      on:change={handleSelectChange}
    >
      <option value="">選択してください</option>
      {#each options as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  {:else if definition.type === 'checkbox'}
    <fieldset class="custom-field-fieldset" aria-describedby={descriptionId ?? undefined}>
      <legend class="custom-field-legend">{labelText}</legend>
      {#if definition.description}
        <p id={descriptionId} class="custom-field-description">{definition.description}</p>
      {/if}
      <div class="custom-field-checkbox-group">
        {#each options as option}
          <label class="custom-field-checkbox">
            <input
              class="custom-field-checkbox-input"
              type="checkbox"
              value={option.value}
              checked={checkboxValues.has(option.value)}
              on:change={(event) => handleCheckboxChange(option, (event.target as HTMLInputElement).checked)}
            />
            <span>{option.label}</span>
          </label>
        {/each}
      </div>
    </fieldset>
  {:else if definition.type === 'file'}
    <FileInput
      label={labelText}
      description={definition.description ?? undefined}
      value={asFileValue(fieldValue)}
      on:change={(e) => onChange(e.detail)}
    />
  {:else if definition.type === 'group'}
    {#if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) === false}
      {ensureGroupObject() ?? ''}
    {/if}
    <fieldset class="custom-field-fieldset" aria-describedby={descriptionId ?? undefined}>
      <legend class="custom-field-legend">{labelText}</legend>
      {#if definition.description}
        <p id={descriptionId} class="custom-field-description">{definition.description}</p>
      {/if}
      <div class="custom-field-group">
        {#each definition.children as child}
          <svelte:self
            definition={child}
            value={fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue) ? (fieldValue as Record<string, unknown>)[slugToCamelCase(child.slug)] : undefined}
            path={fieldPath}
            on:changeValue={(event) => {
              const current = fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue) ? { ...(fieldValue as Record<string, unknown>) } : {};
              current[slugToCamelCase(child.slug)] = event.detail.value;
              onChange(current);
            }}
          />
        {/each}
      </div>
    </fieldset>
  {:else if definition.type === 'repeatable'}
    {#if Array.isArray(fieldValue) === false}
      {ensureRepeatableArray() ?? ''}
    {/if}
    <fieldset class="custom-field-fieldset" aria-describedby={descriptionId ?? undefined}>
      <legend class="custom-field-legend">{labelText}</legend>
      {#if definition.description}
        <p id={descriptionId} class="custom-field-description">{definition.description}</p>
      {/if}
      <div class="custom-field-repeatable">
        {#if minItems}
          <p class="custom-field-hint">最小 {minItems} 件{maxItems ? ` / 最大 ${maxItems} 件` : ''}</p>
        {:else if maxItems}
          <p class="custom-field-hint">最大 {maxItems} 件</p>
        {/if}
        {#each Array.isArray(fieldValue) ? (fieldValue as unknown[]) : [] as item, index}
          <div class="custom-field-repeatable-item">
            <svelte:self
              definition={definition.children[0]}
              value={item}
              path={[...fieldPath, String(index)]}
              on:changeValue={(event) => updateRepeatableItem(index, event.detail.value)}
            />
            <button
              type="button"
              class="custom-field-remove-button"
              on:click={() => removeRepeatableItem(index)}
              disabled={typeof minItems === 'number' && Array.isArray(fieldValue) ? (fieldValue as unknown[]).length <= minItems : false}
            >
              削除
            </button>
          </div>
        {/each}
        <button
          type="button"
          class="custom-field-add-button"
          on:click={addRepeatableItem}
          disabled={typeof maxItems === 'number' && Array.isArray(fieldValue) ? (fieldValue as unknown[]).length >= maxItems : false}
        >
          追加
        </button>
      </div>
    </fieldset>
  {:else}
    <label class="custom-field-label" for={fieldId}>
      <span>{labelText}</span>
      {#if definition.description}
        <span id={descriptionId} class="custom-field-description">{definition.description}</span>
      {/if}
    </label>
    <textarea
      id={fieldId}
      class="custom-field-textarea"
      rows={4}
      aria-describedby={descriptionId ?? undefined}
      on:input={handleTextChange}>{fieldValue ? JSON.stringify(fieldValue, null, 2) : ''}</textarea
    >
  {/if}
</div>

<style>
  .custom-field-node {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 0.5rem;
    background-color: var(--color-surface, #fff);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }

  .custom-field-label {
    display: flex;
    flex-direction: column;
    font-weight: 600;
    gap: 0.25rem;
  }

  .custom-field-description {
    font-size: 0.85rem;
    color: var(--color-text-muted, #6b7280);
  }

  .custom-field-input,
  .custom-field-textarea,
  .custom-field-checkbox-input {
    font: inherit;
  }

  .custom-field-input,
  .custom-field-textarea {
    width: 100%;
    border-radius: 0.375rem;
    border: 1px solid var(--color-border, #d1d5db);
    padding: 0.45rem 0.6rem;
    background: #fff;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .custom-field-input:focus-visible,
  .custom-field-textarea:focus-visible,
  .custom-field-checkbox-input:focus-visible,
  .custom-field-add-button:focus-visible,
  .custom-field-remove-button:focus-visible {
    outline: 3px solid var(--color-focus-ring, rgba(79, 70, 229, 0.35));
    outline-offset: 2px;
    border-color: var(--color-focus-border, #4f46e5);
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
  }

  .custom-field-textarea {
    min-height: 4rem;
  }

  .custom-field-checkbox-group {
    display: grid;
    gap: 0.5rem;
  }

  .custom-field-checkbox {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0.5rem;
    border-radius: 0.375rem;
    transition: background-color 0.2s ease;
  }

  .custom-field-checkbox:hover {
    background-color: rgba(79, 70, 229, 0.08);
  }

  .custom-field-group,
  .custom-field-repeatable {
    display: grid;
    gap: 0.75rem;
  }

  .custom-field-repeatable-item {
    display: grid;
    gap: 0.6rem;
    border: 1px dashed var(--color-border, #d1d5db);
    border-radius: 0.5rem;
    padding: 0.75rem;
    background-color: #f9fafb;
  }

  .custom-field-add-button,
  .custom-field-remove-button {
    width: max-content;
    padding: 0.5rem 0.9rem;
    border-radius: 0.375rem;
    border: 1px solid var(--color-border, #d1d5db);
    background-color: #f9fafb;
    font-size: 0.9rem;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
  }

  .custom-field-add-button:hover,
  .custom-field-remove-button:hover {
    background-color: rgba(79, 70, 229, 0.08);
    border-color: var(--color-focus-border, #4f46e5);
  }

  .custom-field-add-button:disabled,
  .custom-field-remove-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .custom-field-hint {
    font-size: 0.8rem;
    color: var(--color-text-muted, #6b7280);
  }

  .custom-field-fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .custom-field-legend {
    font-weight: 600;
  }

  @media (min-width: 640px) {
    .custom-field-group {
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }

    .custom-field-checkbox-group {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      align-items: start;
    }
  }
</style>
