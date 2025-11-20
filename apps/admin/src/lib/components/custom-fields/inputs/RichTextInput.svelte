<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import RichTextEditor from '../../../custom-fields/RichTextEditor.svelte';
  import type { CustomFieldDefinition } from '../../../custom-fields/types';

  type RichTextValue = { html: string; json: Record<string, unknown> } | null;

  export let definition: CustomFieldDefinition;
  export let value: RichTextValue = null;

  const computePlaceholder = (def: CustomFieldDefinition) => {
    const config = (def?.config ?? {}) as Record<string, unknown>;
    if (typeof config.placeholder === 'string' && config.placeholder.length > 0) {
      return config.placeholder;
    }
    return def.description ?? '本文を入力してください…';
  };

  const resolveToolbarPreset = () => 'full';

  let valueSnapshot: RichTextValue;
  let resolvedPlaceholder: string;
  let toolbarPreset: string;
  let labelId: string;
  let descriptionId: string | undefined;

  $: valueSnapshot = toPlain(value ?? null);
  $: resolvedPlaceholder = computePlaceholder(definition);
  $: toolbarPreset = resolveToolbarPreset();
  $: labelId = `${definition.slug}-label`;
  $: descriptionId = definition.description ? `${definition.slug}-description` : undefined;

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

  function logDev(_label: string, _payload: unknown) {
    // console 出力を抑制
  }

  const dispatch = createEventDispatcher<{ change: RichTextValue }>();

  $: if (typeof window !== 'undefined') {
    const snapshot = valueSnapshot;
    logDev('[rich-text-input] value', {
      slug: definition.slug,
      hasHtml: typeof snapshot?.html === 'string' && snapshot.html.length > 0,
      hasJson: Boolean(snapshot?.json),
      preview: snapshot?.html?.slice(0, 50) ?? null,
    });
  }

  function handleChange(event: CustomEvent<RichTextValue>) {
    const nextValue = toPlain(event.detail ?? null);
    dispatch('change', nextValue);
  }
</script>

<div class="form-field">
  <div id={labelId} class="label">{definition.label}</div>
  <div class="editor-wrapper" role="group" aria-labelledby={labelId} aria-describedby={descriptionId}>
    <RichTextEditor value={valueSnapshot} placeholder={resolvedPlaceholder} {toolbarPreset} on:change={handleChange} />
  </div>
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
    @apply block text-sm font-medium text-gray-700 mb-2;
  }
  .editor-wrapper {
    @apply rounded-md border border-gray-300 p-2;
  }
  .help-text {
    @apply mt-2 text-xs text-gray-500;
  }
</style>
