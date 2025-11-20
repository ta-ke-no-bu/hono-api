<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CustomFieldDefinition } from '../../../custom-fields/types';

  type TextFieldDefinition = CustomFieldDefinition & {
    config?: { multiline?: boolean } | null;
  };

  type Props = {
    definition: TextFieldDefinition;
    value?: string;
  };

  const props = $props<Props>();

  const dispatch = createEventDispatcher<{ change: string }>();

  let currentValue = $state.raw(typeof props.value === 'string' ? props.value : (props.value ?? ''));

  $effect(() => {
    if (typeof props.value === 'string') {
      currentValue = props.value;
    } else if (props.value === null || props.value === undefined) {
      currentValue = '';
    }
  });

  const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    currentValue = target.value;
    dispatch('change', currentValue ?? '');
  };

  let isMultiline = $state.raw(false);

  $effect(() => {
    const config = props.definition?.config as { multiline?: boolean } | null | undefined;
    isMultiline = Boolean(config?.multiline);
  });
</script>

<div class="form-field">
  <label for={props.definition.slug} class="label">{props.definition.label}</label>
  {#if isMultiline}
    <textarea
      id={props.definition.slug}
      name={props.definition.slug}
      class="input"
      rows="4"
      bind:value={currentValue}
      oninput={handleInput}
      placeholder={props.definition.description ?? ''}
    ></textarea>
  {:else}
    <input
      id={props.definition.slug}
      name={props.definition.slug}
      type="text"
      class="input"
      bind:value={currentValue}
      oninput={handleInput}
      placeholder={props.definition.description ?? ''}
    />
  {/if}
  {#if props.definition.description}
    <p class="help-text">{props.definition.description}</p>
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
