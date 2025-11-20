<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CustomFieldDefinition } from '../../../custom-fields/types';

  type DateFieldDefinition = CustomFieldDefinition & {
    config?: { mode?: 'date' | 'datetime' } | null;
  };

  export let definition: DateFieldDefinition;
  export let value: string | undefined;

  const dispatch = createEventDispatcher<{ change: string | undefined }>();

  const resolveInputType = (def: DateFieldDefinition) =>
    (def.config as { mode?: 'date' | 'datetime' } | null | undefined)?.mode === 'datetime' ? 'datetime-local' : 'date';

  let inputType: 'date' | 'datetime-local' = resolveInputType(definition);
  let displayValue = '';

  const toDisplayValue = (raw: string | undefined) => {
    if (!raw) {
      return '';
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return '';
    }

    if (inputType === 'date') {
      return trimmed.slice(0, 10);
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return trimmed.slice(0, 16);
    }

    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  };

  $: inputType = resolveInputType(definition);
  $: displayValue = toDisplayValue(value);

  const toIsoString = (raw: string) => {
    if (!raw) {
      return undefined;
    }

    if (inputType === 'date') {
      const candidate = `${raw}T00:00`;
      const parsed = new Date(candidate);
      return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  };

  const handleChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const nextValue = target.value ? toIsoString(target.value) : undefined;
    value = nextValue;
    dispatch('change', nextValue);
  };
</script>

<div class="form-field">
  <label for={definition.slug} class="label">{definition.label}</label>
  <input
    id={definition.slug}
    name={definition.slug}
    type={inputType}
    class="input"
    value={displayValue}
    oninput={handleChange}
    placeholder={definition.description ?? ''}
  />
  {#if definition.description}
    <p class="help-text">{definition.description}</p>
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
