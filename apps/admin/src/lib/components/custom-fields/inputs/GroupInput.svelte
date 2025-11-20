<script lang="ts">
  import { slugToCamelCase } from '@repo/utils';
  import { createEventDispatcher, getContext } from 'svelte';
  import type { ComponentType } from 'svelte';
  import type { CustomFieldDefinition } from '../../../custom-fields/types';

  type Props = {
    definition: CustomFieldDefinition;
    value?: Record<string, unknown>;
  };

  const props = $props<Props>();
  // export let inputComponents: { [key: string]: any } = {}; // 親から渡される入力コンポーネントマップ
  const inputComponents = getContext<Record<string, ComponentType>>('inputComponents');

  const initialValue = props.value ? { ...props.value } : {};
  let value = $state.raw<Record<string, unknown>>(initialValue);

  $effect(() => {
    if (props.value && typeof props.value === 'object') {
      value = { ...props.value };
    } else {
      value = {};
    }
  });

  const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

  const updateChildValue = (slug: string, detail: unknown) => {
    const key = slugToCamelCase(slug);
    value = {
      ...value,
      [key]: detail,
    };
    dispatch('change', value);
  };

  const handleChildChange = (slug: string, event: Event) => {
    const custom = event as CustomEvent<unknown>;
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
    const detail = custom.detail ?? target?.value;
    updateChildValue(slug, detail);
  };
</script>

<div class="form-field rounded-md border border-gray-200 p-4">
  <h3 class="text-lg font-medium mb-3">{props.definition.label}</h3>
  {#if props.definition.description}
    <p class="help-text mb-3">{props.definition.description}</p>
  {/if}

  <div class="space-y-4 pl-4 border-l border-gray-300">
    {#each props.definition.children as childDefinition (childDefinition.id)}
      {#if inputComponents[childDefinition.type]}
        {@const ChildComponent = inputComponents[childDefinition.type]}
        <ChildComponent
          definition={childDefinition}
          value={value[slugToCamelCase(childDefinition.slug)]}
          on:change={(event) => handleChildChange(childDefinition.slug, event)}
        />
      {:else}
        <p class="text-red-500">未対応のフィールドタイプ: {childDefinition.type}</p>
      {/if}
    {/each}
  </div>
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';

  .form-field {
    margin-bottom: calc(var(--spacing) * 2);
  }
  .help-text {
    @apply mt-1 text-xs text-gray-500;
  }
</style>
