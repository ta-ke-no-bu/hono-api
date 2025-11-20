<script lang="ts">
  import type { CustomFieldDefinition } from '@lib/types';

  export let definition: CustomFieldDefinition;
  export let depth = 0;
  export let index = 0;
  export let siblingsCount = 0;
  export let onEdit: (definition: CustomFieldDefinition) => void;
  export let onAddChild: (definition: CustomFieldDefinition) => void;
  export let onMoveUp: (definition: CustomFieldDefinition) => void;
  export let onMoveDown: (definition: CustomFieldDefinition) => void;

  const isNestable = definition.type === 'group' || definition.type === 'repeatable';
  const canMoveUp = index > 0;
  const canMoveDown = index < siblingsCount - 1;
</script>

<li class="rounded-md border border-gray-200 bg-white p-3" style={`margin-left: ${depth * 12}px`}>
  <div class="flex flex-col gap-2">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-gray-900">{definition.label}</span>
          <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{definition.slug}</span>
          <span class="text-xs text-gray-500">{definition.type}</span>
          <span class="text-xs text-gray-400">order: {definition.order}</span>
        </div>
        {#if definition.description}
          <p class="text-xs text-gray-600">{definition.description}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2 text-xs">
        <button
          type="button"
          class="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:border-gray-400 disabled:opacity-40"
          onclick={() => onMoveUp(definition)}
          disabled={!canMoveUp}
        >
          ↑
        </button>
        <button
          type="button"
          class="rounded border border-gray-300 px-2 py-1 text-gray-600 hover:border-gray-400 disabled:opacity-40"
          onclick={() => onMoveDown(definition)}
          disabled={!canMoveDown}
        >
          ↓
        </button>
        <button type="button" class="text-indigo-600 hover:underline" onclick={() => onEdit(definition)}> 編集 </button>
        {#if isNestable}
          <button type="button" class="text-indigo-600 hover:underline" onclick={() => onAddChild(definition)}>
            子フィールド追加
          </button>
        {/if}
        <form
          method="POST"
          action="?/deleteDefinition"
          on:submit={(event) => {
            if (!confirm(`「${definition.label}」を削除しますか？`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={definition.id} />
          <button type="submit" class="text-red-600 hover:underline">削除</button>
        </form>
      </div>
    </div>
    {#if definition.children && definition.children.length > 0}
      <ul class="space-y-2 border-l border-dashed border-gray-300 pl-3">
        {#each definition.children as child, childIndex (child.id)}
          <svelte:self
            definition={child}
            depth={depth + 1}
            index={childIndex}
            siblingsCount={definition.children.length}
            {onEdit}
            {onAddChild}
            {onMoveUp}
            {onMoveDown}
          />
        {/each}
      </ul>
    {/if}
  </div>
</li>

<style>
  button:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }
</style>
