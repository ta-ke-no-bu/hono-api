<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CustomFieldDefinition } from '../../../custom-fields/types';

  type SelectOption = { label: string; value: string };
  type SelectValue = { label: string; value: string } | null;

  type SelectFieldDefinition = CustomFieldDefinition & {
    config?: { options?: SelectOption[] } | null;
  };

  export let definition: SelectFieldDefinition;
  export let value: SelectValue | string | null = null;

  const dispatch = createEventDispatcher<{ change: SelectValue }>();

  let selectedValue = '';

  $: labelId = `${definition.slug}-label`;
  $: descriptionId = definition.description ? `${definition.slug}-description` : undefined;
  $: rawOptions = Array.isArray(definition?.config?.options) ? (definition.config?.options as SelectOption[]) : [];
  $: options = rawOptions
    .filter((option): option is SelectOption => Boolean(option?.value) && Boolean(option?.label))
    .map((option) => ({
      label: option.label.trim(),
      value: option.value.trim(),
    }));

  $: syncSelectedValue(value);

  $: {
    if (options.length > 0 && selectedValue && !options.some((option) => option.value === selectedValue)) {
      selectedValue = '';
      dispatch('change', null);
    }
  }

  function syncSelectedValue(input: SelectValue | string | null) {
    if (typeof input === 'string') {
      selectedValue = input;
      return;
    }
    if (input && typeof input === 'object' && typeof input.value === 'string') {
      selectedValue = input.value;
      return;
    }
    selectedValue = '';
  }

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedValue = target.value;

    if (!selectedValue) {
      dispatch('change', null);
      return;
    }

    const option = options.find((item) => item.value === selectedValue);
    dispatch(
      'change',
      option ? { value: option.value, label: option.label } : { value: selectedValue, label: selectedValue },
    );
  }
</script>

<div class="form-field">
  <label id={labelId} for={`${definition.slug}-select`} class="label">{definition.label}</label>
  <select
    id={`${definition.slug}-select`}
    name={definition.slug}
    class="input"
    bind:value={selectedValue}
    aria-labelledby={labelId}
    aria-describedby={descriptionId}
    onchange={handleChange}
  >
    <option value="">選択してください</option>
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if definition.description}
    <p id={descriptionId} class="help-text">{definition.description}</p>
  {/if}
</div>

<style>
  @reference '@repo/tailwind-config/tailwind.css';

  .form-field {
    margin-bottom: calc(var(--spacing) * 2);
  }
  .label {
    @apply block text-sm font-medium text-gray-700;
  }
  .input {
    @apply mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500;
  }
  .help-text {
    @apply mt-1 text-xs text-gray-500;
  }
</style>
