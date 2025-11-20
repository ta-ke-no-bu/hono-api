<script lang="ts">
  import type { LocalDefinition } from './definition-helpers';

  export let definition: LocalDefinition;
  export let depth = 0;
  export let index = 0;
  export let siblingsCount = 0;
  export let onAddChild: (definition: LocalDefinition) => void;
  export let onEdit: (definition: LocalDefinition) => void;
  export let onDelete: (definition: LocalDefinition) => void;
  export let onMoveUp: (definition: LocalDefinition) => void;
  export let onMoveDown: (definition: LocalDefinition) => void;

  const isNestable = definition.type === 'group';
  const canMoveUp = index > 0;
  const canMoveDown = index < siblingsCount - 1;
</script>

<li class="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
  <div class="flex flex-col gap-2">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-gray-900">{definition.label}</span>
          <code class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{definition.slug}</code>
          <span class="text-xs text-gray-500">
            {definition.type}{definition.isRepeatable ? ' (repeatable)' : ''}
          </span>
          <span class="text-xs text-gray-400">order: {definition.order}</span>
        </div>
        {#if definition.description}
          <p class="text-xs text-gray-600">{definition.description}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2 text-xs">
        <button
          type="button"
          class="rounded border border-gray-300 px-2 py-1 text-gray-600 transition hover:border-gray-400 disabled:opacity-40"
          onclick={() => onMoveUp(definition)}
          disabled={!canMoveUp}
        >
          ↑
        </button>
        <button
          type="button"
          class="rounded border border-gray-300 px-2 py-1 text-gray-600 transition hover:border-gray-400 disabled:opacity-40"
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
        <button type="button" class="text-red-600 hover:underline" onclick={() => onDelete(definition)}> 削除 </button>
      </div>
    </div>
    {#if definition.children && definition.children.length > 0}
      <ul class="space-y-2 border-l border-dashed border-gray-300 pl-4">
        {#each definition.children as child, childIndex (child.id)}
          <svelte:self
            definition={child}
            depth={depth + 1}
            index={childIndex}
            siblingsCount={definition.children.length}
            {onAddChild}
            {onEdit}
            {onDelete}
            {onMoveUp}
            {onMoveDown}
          />
        {/each}
      </ul>
    {/if}
  </div>
</li>
