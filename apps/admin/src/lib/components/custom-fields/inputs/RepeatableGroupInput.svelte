<script lang="ts">
  import { createDefaultValue, createInitialValues } from '@lib/custom-fields/valueHelpers';
  import { slugToCamelCase } from '@repo/utils';
  import { createEventDispatcher, getContext } from 'svelte';
  import type { ComponentType } from 'svelte';
  import type { CustomFieldDefinition } from '../../../custom-fields/types';
  import GroupInput from './GroupInput.svelte';

  type RepeatableProps = {
    definition: CustomFieldDefinition;
    value?: unknown[];
  };

  const props = $props<RepeatableProps>();

  const dispatch = createEventDispatcher<{ change: unknown[] }>();
  const inputComponents = getContext<Record<string, ComponentType>>('inputComponents');

  const resolveMinItems = () => {
    const validation = (props.definition?.validation ?? {}) as Record<string, unknown>;
    if (typeof validation.minItems === 'number') {
      return validation.minItems;
    }
    return validation.required ? 1 : 0;
  };

  let childDefinition = $state<CustomFieldDefinition | null>(
    Array.isArray(props.definition.children) && props.definition.children.length > 0
      ? (props.definition.children[0] as CustomFieldDefinition)
      : null,
  );

  $effect(() => {
    childDefinition =
      Array.isArray(props.definition.children) && props.definition.children.length > 0
        ? (props.definition.children[0] as CustomFieldDefinition)
        : null;
  });

  const isLeafField = (definition: CustomFieldDefinition | null) =>
    Boolean(definition && definition.type !== 'group' && definition.type !== 'repeatable');

  const normalizeLeafValue = (definition: CustomFieldDefinition, value: unknown) => {
    if (definition.type === 'select') {
      if (typeof value === 'object' && value !== null && 'value' in (value as Record<string, unknown>)) {
        const candidate = (value as Record<string, unknown>).value;
        return typeof candidate === 'string' ? candidate : '';
      }
      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object') {
        const camelKey = slugToCamelCase(definition.slug);
        const candidate = (value as Record<string, unknown>)[camelKey];
        return typeof candidate === 'string' ? candidate : '';
      }
      return '';
    }
    if (definition.type === 'checkbox') {
      return Array.isArray(value) ? value : [];
    }
    if (definition.type === 'file') {
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    }
    if (definition.type === 'richText') {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const html = (value as Record<string, unknown>).html;
        const json = (value as Record<string, unknown>).json;
        if (typeof html === 'string' && json !== undefined) {
          return { html, json };
        }
      }
      return null;
    }
    if (definition.type === 'date' || definition.type === 'text') {
      if (typeof value === 'string') {
        return value;
      }
      if (value && typeof value === 'object') {
        const camelKey = slugToCamelCase(definition.slug);
        const candidate = (value as Record<string, unknown>)[camelKey];
        return typeof candidate === 'string' ? candidate : '';
      }
      return '';
    }
    return value;
  };

  const ensureValueShape = (source: unknown): unknown[] => {
    if (!Array.isArray(source)) {
      return [];
    }
    if (childDefinition && isLeafField(childDefinition)) {
      return source.map((item) => normalizeLeafValue(childDefinition as CustomFieldDefinition, item));
    }
    const camelChildSlug =
      childDefinition && !isLeafField(childDefinition) ? slugToCamelCase(childDefinition.slug) : null;

    return source
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => {
        if (!camelChildSlug) {
          return item;
        }
        const key = camelChildSlug;
        if (key in item) {
          return item;
        }
        return { [key]: item };
      });
  };

  const logDev = (label: string, payload: unknown) => {
    if (typeof window === 'undefined' || !import.meta.env.DEV) {
      return;
    }
    console.warn(`[repeatable:${props.definition.slug}] ${label}`, payload);
  };

  const serializeItems = (input: unknown[]): string => {
    try {
      return JSON.stringify(input);
    } catch {
      return '';
    }
  };

  const createDefaultItem = () => {
    if (!childDefinition) {
      return {};
    }
    if (isLeafField(childDefinition)) {
      return createDefaultValue(childDefinition);
    }
    if (props.definition.children) {
      return createInitialValues(props.definition.children as CustomFieldDefinition[]);
    }
    return {};
  };

  const buildInitialItems = (source: unknown) => {
    const list = ensureValueShape(source);
    const minItems = resolveMinItems();
    if (list.length === 0 && minItems === 0) {
      return list;
    }
    const next = [...list];
    const requiredCount = Math.max(minItems, next.length || 1);
    while (next.length < requiredCount) {
      next.push(createDefaultItem());
    }
    return next;
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

  let items = $state.raw<unknown[]>(buildInitialItems(props.value));
  let serializedItems = serializeItems(items);

  const applyItems = (nextItems: unknown[]) => {
    items = nextItems;
    serializedItems = serializeItems(nextItems);
  };

  $effect(() => {
    const nextItems = buildInitialItems(props.value);
    const nextSerialized = serializeItems(nextItems);
    if (nextSerialized === serializedItems) {
      return;
    }
    applyItems(nextItems);
    logDev('initialize', { items: nextItems, raw: props.value });
  });

  function emitChange(nextItems: unknown[]) {
    dispatch('change', toPlain(nextItems));
    logDev('emitChange', nextItems);
  }

  function addItem() {
    const nextItems = [...items, createDefaultItem()];
    applyItems(nextItems);
    logDev('addItem', nextItems);
    emitChange(nextItems);
  }

  function removeItem(index: number) {
    const nextItems = items.filter((_, i) => i !== index);
    applyItems(nextItems);
    logDev('removeItem', { index, items: nextItems });
    emitChange(nextItems);
  }

  function updateItem(index: number, newValue: unknown) {
    const nextItems = items.map((item, i) => (i === index ? toPlain(newValue) : item));
    applyItems(nextItems);
    logDev('updateItem', { index, value: nextItems[index] });
    emitChange(nextItems);
  }

  const handleLeafChange = (index: number, event: Event) => {
    if (!childDefinition) {
      return;
    }
    const custom = event as CustomEvent<unknown>;
    const detail = custom.detail;
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
    const nextValue =
      detail !== undefined ? detail : target && 'value' in target ? (target as HTMLInputElement).value : undefined;
    logDev('leafChange', { index, detail: nextValue });
    updateItem(index, normalizeLeafValue(childDefinition, nextValue));
  };
</script>

<div class="form-field rounded-md border border-dashed border-gray-300 p-4">
  <h3 class="text-lg font-medium mb-3">{props.definition.label} (繰り返し)</h3>
  {#if props.definition.description}
    <p class="help-text mb-3">{props.definition.description}</p>
  {/if}

  <div class="space-y-4">
    {#each items as item, i (i)}
      <div class="relative rounded-md border border-gray-200 p-4">
        {#if childDefinition && isLeafField(childDefinition)}
          {#if inputComponents?.[childDefinition.type]}
            {@const LeafComponent = inputComponents[childDefinition.type]}
            <LeafComponent
              definition={childDefinition}
              value={item}
              on:change={(event) => handleLeafChange(i, event)}
            />
          {:else}
            <p class="text-red-500">未対応のフィールドタイプ: {childDefinition.type}</p>
          {/if}
        {:else}
          <GroupInput
            definition={{ ...props.definition, isRepeatable: false }}
            value={item as Record<string, unknown>}
            on:change={(event) => updateItem(i, event.detail)}
          />
        {/if}
        {#if items.length > 1}
          <button
            type="button"
            onclick={() => removeItem(i)}
            class="absolute top-2 right-2 text-red-500 hover:text-red-700"
            aria-label="項目を削除"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <button type="button" onclick={addItem} class="btn-secondary mt-4">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
        clip-rule="evenodd"
      ></path>
    </svg>
    {props.definition.label}を追加
  </button>
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';

  .form-field {
    margin-bottom: calc(var(--spacing) * 2);
  }
  .help-text {
    @apply mt-1 text-xs text-gray-500;
  }
  .btn-secondary {
    @apply inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50;
  }
</style>
