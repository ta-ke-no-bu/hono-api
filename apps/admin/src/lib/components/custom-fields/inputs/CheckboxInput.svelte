<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CustomFieldDefinition } from '../../../custom-fields/types';

  type CheckboxOption = { label: string; value: string };
  type CheckboxValue = { label: string; value: string };

  type CheckboxFieldDefinition = CustomFieldDefinition & {
    config?: { options?: CheckboxOption[] } | null;
  };

  export let definition: CheckboxFieldDefinition;
  export let value: CheckboxValue[] | string[] | null = null;

  const dispatch = createEventDispatcher<{ change: CheckboxValue[] }>();

  let selectedValues: string[] = [];

  $: options = Array.isArray(definition?.config?.options)
    ? (definition.config?.options as CheckboxOption[])
        .filter((option): option is CheckboxOption => Boolean(option?.value) && Boolean(option?.label))
        .map((option) => ({
          label: option.label.trim(),
          value: option.value.trim(),
        }))
    : [];

  $: syncSelectedValues(value);

  $: {
    const filtered = selectedValues.filter((selected) => options.some((option) => option.value === selected));
    if (filtered.length !== selectedValues.length) {
      selectedValues = filtered;
      emitChange();
    }
  }

  function syncSelectedValues(input: CheckboxValue[] | string[] | null) {
    if (!Array.isArray(input)) {
      selectedValues = [];
      return;
    }
    const collected = input
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && typeof item.value === 'string' && item.value.length > 0) {
          return item.value;
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry));
    selectedValues = Array.from(new Set(collected));
  }

  function emitChange() {
    const payload = selectedValues.map((value) => {
      const option = options.find((item) => item.value === value);
      if (option) {
        return { value: option.value, label: option.label };
      }
      return { value, label: value };
    });
    dispatch('change', payload);
  }

  function toggle(optionValue: string, checked: boolean) {
    const set = new Set(selectedValues);
    if (checked) {
      set.add(optionValue);
    } else {
      set.delete(optionValue);
    }
    selectedValues = Array.from(set);
    emitChange();
  }

  function isChecked(optionValue: string) {
    return selectedValues.includes(optionValue);
  }
</script>

<fieldset class="form-field">
  <legend class="label">{definition.label}</legend>
  <div class="mt-1 space-y-2">
    {#each options as option}
      <label class="flex items-center">
        <input
          type="checkbox"
          class="checkbox"
          value={option.value}
          checked={isChecked(option.value)}
          onchange={(event) => toggle(option.value, (event.currentTarget as HTMLInputElement).checked)}
        />
        <span class="ml-2 text-sm text-gray-900">{option.label}</span>
      </label>
    {/each}
  </div>
  {#if definition.description}
    <p class="help-text">{definition.description}</p>
  {/if}
</fieldset>

<style>
  @reference '@repo/tailwind-config/tailwind.css';

  .form-field {
    margin-bottom: calc(var(--spacing) * 2);
  }
  .label {
    @apply block text-sm font-medium text-gray-700;
  }
  .checkbox {
    @apply h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500;
  }
  .help-text {
    @apply mt-1 text-xs text-gray-500;
  }
</style>
