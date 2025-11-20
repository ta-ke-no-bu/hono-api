<svelte:options runes={false} />
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { CustomFieldDefinition } from '../../custom-fields/types';

  export let definition: CustomFieldDefinition;
  export let level = 0;
  export let openEditor: (def: CustomFieldDefinition) => void;
</script>

<li class="rounded-md border border-gray-200 p-3" style={`padding-left: ${level}rem`}>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <!-- Drag Handle -->
      <span class="cursor-grab text-gray-400 hover:text-gray-600">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clip-rule="evenodd"
          ></path>
        </svg>
      </span>
      <span class="font-semibold">{definition.label}</span>
      <span class="text-xs text-gray-500">({definition.type})</span>
    </div>
    <div class="flex items-center gap-4">
      <button on:click={() => openEditor(definition)} class="text-sm font-medium text-indigo-600 hover:underline"
        >編集</button
      >
      <form
        method="POST"
        action="?/deleteDefinition"
        use:enhance
        on:submit={(e) => !confirm(`「${definition.label}」を削除しますか？`) && e.preventDefault()}
      >
        <input type="hidden" name="id" value={definition.id} />
        <button type="submit" class="text-sm font-medium text-red-600 hover:underline">削除</button>
      </form>
    </div>
  </div>

  {#if definition.children && definition.children.length > 0}
    <ul class="mt-2 space-y-2 border-l border-gray-200 pl-4">
      {#each definition.children as child (child.id)}
        <svelte:self definition={child} level={level + 1} {openEditor} />
      {/each}
    </ul>
  {/if}
</li>
