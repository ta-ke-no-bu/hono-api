<svelte:options runes={false} />
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import CustomFieldField from './CustomFieldField.svelte';
  import type { ChangeValueDetail, CustomFieldDefinition } from './types';

  export let definitions: CustomFieldDefinition[] = [];
  export let value: Record<string, unknown> | null = null;

  const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

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

  let formValue: Record<string, unknown> = {};
  let lastValueRef: Record<string, unknown> | null | undefined = null;

  const syncFromProps = () => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      formValue = { ...value };
    } else {
      formValue = {};
    }
  };

  $: if (value !== lastValueRef) {
    syncFromProps();
    lastValueRef = value;
  }

  const handleFieldChange = (detail: ChangeValueDetail) => {
    formValue = {
      ...formValue,
      [detail.key]: detail.value,
    };
    dispatch('change', formValue);
  };

  onMount(() => {
    syncFromProps();
    lastValueRef = value;
    dispatch('change', formValue);
  });
</script>

<div class="custom-field-form">
  {#if definitions.length === 0}
    <p class="custom-field-empty">このセットにはカスタムフィールドが定義されていません。</p>
  {:else}
    <div class="custom-field-grid">
      {#each definitions as definition (definition.id)}
        <CustomFieldField
          {definition}
          value={formValue?.[slugToCamelCase(definition.slug)]}
          on:changeValue={(event) => handleFieldChange(event.detail)}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .custom-field-form {
    display: grid;
    gap: 1rem;
  }

  .custom-field-grid {
    display: grid;
    gap: 1rem;
  }

  .custom-field-empty {
    font-size: 0.9rem;
    color: var(--color-text-muted, #6b7280);
  }
</style>
