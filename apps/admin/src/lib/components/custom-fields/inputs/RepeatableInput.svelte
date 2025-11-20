<script lang="ts">
  import { createDefaultValue } from '@lib/custom-fields/valueHelpers';
  import { createEventDispatcher, getContext } from 'svelte';
  import type { ComponentType } from 'svelte';
  import type { CustomFieldDefinition } from '../../../custom-fields/types';

  type RepeatableConfig = { minItems?: number; maxItems?: number };

  type RepeatableFieldDefinition = CustomFieldDefinition & {
    itemDefinition?: CustomFieldDefinition;
    config?: RepeatableConfig | null;
  };

  type Props = {
    definition: RepeatableFieldDefinition;
    value?: unknown[];
  };

  const { definition, value: initialValue = [] } = $props<Props>();
  // export let inputComponents: { [key: string]: any } = {}; // 親から渡される入力コンポーネントマップ
  const inputComponents = getContext<Record<string, ComponentType>>('inputComponents');

  let value = $state<unknown[]>(Array.isArray(initialValue) ? [...initialValue] : []);

  const dispatch = createEventDispatcher<{ change: unknown[] }>();

  const minItems = $derived(() => {
    const config = definition.config as RepeatableConfig | null | undefined;
    return config?.minItems ?? 0;
  });
  const maxItems = $derived(() => {
    const config = definition.config as RepeatableConfig | null | undefined;
    return config?.maxItems ?? Number.POSITIVE_INFINITY;
  });

  const resolveChildDefinition = () => definition.itemDefinition ?? definition.children?.[0];

  function addItem() {
    if (value && value.length < maxItems) {
      const childDefinition = resolveChildDefinition();
      if (!childDefinition) {
        return;
      }
      const newItem = createDefaultValue(childDefinition);
      value = [...value, newItem];
      dispatch('change', value);
    }
  }

  function removeItem(index: number) {
    if (value && value.length > minItems) {
      value = value.filter((_, i) => i !== index);
      dispatch('change', value);
    }
  }

  const updateItemValue = (index: number, detail: unknown) => {
    const next = Array.isArray(value) ? [...value] : [];
    next[index] = detail;
    value = next;
    dispatch('change', value);
  };

  const handleChildChange = (index: number, event: Event) => {
    const custom = event as CustomEvent<unknown>;
    const detail =
      custom.detail ?? (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined)?.value;
    updateItemValue(index, detail);
  };

  $effect(() => {
    const childDefinition = resolveChildDefinition();
    if (!childDefinition) {
      return;
    }
    if (value.length < minItems) {
      const next = [...value];
      while (next.length < minItems && next.length < maxItems) {
        next.push(createDefaultValue(childDefinition));
      }
      if (next.length !== value.length) {
        value = next;
        dispatch('change', value);
      }
    }
  });
</script>

<div class="form-field rounded-md border border-gray-200 p-4">
  <h3 class="text-lg font-medium mb-3">{definition.label} (繰り返し)</h3>
  {#if definition.description}
    <p class="help-text mb-3">{definition.description}</p>
  {/if}

  <div class="space-y-4">
    {#each value as _, index (index)}
      <div class="rounded-md border border-gray-300 p-3 space-y-3">
        <div class="flex justify-between items-center">
          <h4 class="font-medium">アイテム {index + 1}</h4>
          <button
            type="button"
            onclick={() => removeItem(index)}
            class="text-red-500 hover:text-red-700 text-sm"
            disabled={value.length <= minItems}
          >
            削除
          </button>
        </div>

        <div class="space-y-3 pl-4 border-l border-gray-200">
          {#if inputComponents[definition.itemDefinition.type]}
            {@const ChildComponent = inputComponents[definition.itemDefinition.type]}
            <ChildComponent
              definition={definition.itemDefinition}
              value={value[index]}
              on:change={(event) => handleChildChange(index, event)}
            />
          {:else}
            <p class="text-red-500">未対応の繰り返しアイテムタイプ: {definition.itemDefinition.type}</p>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <button type="button" onclick={addItem} class="btn-secondary mt-4" disabled={value.length >= maxItems}>
    アイテムを追加
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
