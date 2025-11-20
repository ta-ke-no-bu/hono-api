<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import LocalDefinitionModal from './LocalDefinitionModal.svelte';
  import LocalDefinitionNode from './LocalDefinitionNode.svelte';
  import { cloneLocalDefinitions, normalizeOrders } from './definition-helpers';
  import type { LocalDefinition } from './definition-helpers';

  export let value: LocalDefinition[] = [];

  const dispatch = createEventDispatcher<{ change: LocalDefinition[] }>();

  let definitions: LocalDefinition[] = [];
  let lastExternalValue: LocalDefinition[] | null = null;

  let modalOpen = false;
  let modalMode: 'create' | 'edit' = 'create';
  let activeDefinition: LocalDefinition | null = null;
  let parentCandidateId: string | null = null;
  let parentCandidateLabel: string | null = null;
  let modalSessionKey = 0;

  $: if (value !== lastExternalValue) {
    definitions = normalizeOrders(cloneLocalDefinitions(value));
    lastExternalValue = value;
  }

  function cloneSingle(definition: LocalDefinition): LocalDefinition {
    return cloneLocalDefinitions([definition])[0];
  }

  function emitChange() {
    const normalized = normalizeOrders(cloneLocalDefinitions(definitions));
    definitions = normalized;
    dispatch('change', cloneLocalDefinitions(normalized));
  }

  function findNode(nodes: LocalDefinition[], id: string): LocalDefinition | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      const found = findNode(node.children ?? [], id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  function findParentAndSiblings(
    nodes: LocalDefinition[],
    id: string,
    parent: LocalDefinition | null = null,
  ): { siblings: LocalDefinition[]; parent: LocalDefinition | null } | null {
    const siblings = parent ? (parent.children ?? []) : nodes;
    const index = siblings.findIndex((item) => item.id === id);
    if (index !== -1) {
      return { siblings, parent };
    }
    for (const node of siblings) {
      const result = findParentAndSiblings(node.children ?? [], id, node);
      if (result) {
        return result;
      }
    }
    return null;
  }

  function addDefinitionToTree(nodes: LocalDefinition[], def: LocalDefinition): LocalDefinition[] {
    const draft = cloneLocalDefinitions(nodes);
    if (!def.parentId) {
      draft.push({ ...def, children: def.children ?? [] });
      return draft;
    }
    const parent = findNode(draft, def.parentId);
    if (parent) {
      parent.children = parent.children ?? [];
      parent.children.push({ ...def, parentId: parent.id, children: def.children ?? [] });
    }
    return draft;
  }

  function updateDefinitionInTree(nodes: LocalDefinition[], def: LocalDefinition): LocalDefinition[] {
    return nodes.map((node) => {
      if (node.id === def.id) {
        return {
          ...node,
          ...def,
          children: def.children ?? node.children ?? [],
        };
      }
      return {
        ...node,
        children: updateDefinitionInTree(node.children ?? [], def),
      };
    });
  }

  function deleteDefinitionFromTree(nodes: LocalDefinition[], id: string): LocalDefinition[] {
    const result: LocalDefinition[] = [];
    for (const node of nodes) {
      if (node.id === id) {
        continue;
      }
      result.push({
        ...node,
        children: deleteDefinitionFromTree(node.children ?? [], id),
      });
    }
    return result;
  }

  function moveDefinitionInTree(nodes: LocalDefinition[], id: string, direction: 'up' | 'down'): LocalDefinition[] {
    const draft = cloneLocalDefinitions(nodes);
    const result = findParentAndSiblings(draft, id);
    if (!result) {
      return draft;
    }
    const { siblings } = result;
    const index = siblings.findIndex((item) => item.id === id);
    if (index === -1) {
      return draft;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      return draft;
    }
    const [removed] = siblings.splice(index, 1);
    siblings.splice(targetIndex, 0, removed);
    return draft;
  }

  function getLabelById(id: string | null): string {
    if (!id) {
      return 'トップレベル';
    }
    const node = findNode(definitions, id);
    return node ? node.label : 'トップレベル';
  }

  function openCreateRoot() {
    modalSessionKey += 1;
    modalMode = 'create';
    activeDefinition = null;
    parentCandidateId = null;
    parentCandidateLabel = 'トップレベル';
    modalOpen = true;
  }

  function openCreateChild(node: LocalDefinition) {
    modalSessionKey += 1;
    modalMode = 'create';
    activeDefinition = null;
    parentCandidateId = node.id;
    parentCandidateLabel = node.label;
    modalOpen = true;
  }

  function openEdit(node: LocalDefinition) {
    modalSessionKey += 1;
    modalMode = 'edit';
    activeDefinition = cloneSingle(node);
    parentCandidateId = node.parentId;
    parentCandidateLabel = getLabelById(node.parentId);
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
    activeDefinition = null;
    parentCandidateId = null;
    parentCandidateLabel = null;
  }

  function handleModalSave(event: CustomEvent<{ definition: LocalDefinition }>) {
    if (modalMode === 'create') {
      definitions = addDefinitionToTree(definitions, event.detail.definition);
    } else if (modalMode === 'edit') {
      definitions = updateDefinitionInTree(definitions, event.detail.definition);
    }
    definitions = normalizeOrders(definitions);
    closeModal();
    emitChange();
  }

  function handleDelete(node: LocalDefinition) {
    if (typeof window !== 'undefined') {
      if (!window.confirm(`「${node.label}」を削除しますか？`)) {
        return;
      }
    }
    definitions = normalizeOrders(deleteDefinitionFromTree(definitions, node.id));
    emitChange();
  }

  function handleMove(node: LocalDefinition, direction: 'up' | 'down') {
    definitions = normalizeOrders(moveDefinitionInTree(definitions, node.id, direction));
    emitChange();
  }
</script>

<section class="space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-semibold text-gray-900">カスタムフィールド定義</h3>
    <button
      type="button"
      class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      onclick={openCreateRoot}
    >
      フィールドを追加
    </button>
  </div>

  {#if definitions.length === 0}
    <p class="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
      まだフィールドが定義されていません。「フィールドを追加」ボタンから作成できます。
    </p>
  {:else}
    <ul class="space-y-3">
      {#each definitions as definition, index (definition.id)}
        <LocalDefinitionNode
          {definition}
          depth={0}
          {index}
          siblingsCount={definitions.length}
          onAddChild={openCreateChild}
          onEdit={openEdit}
          onDelete={handleDelete}
          onMoveUp={(node) => handleMove(node, 'up')}
          onMoveDown={(node) => handleMove(node, 'down')}
        />
      {/each}
    </ul>
  {/if}
</section>

<LocalDefinitionModal
  open={modalOpen}
  mode={modalMode}
  definition={activeDefinition}
  {parentCandidateId}
  parentLabel={parentCandidateLabel}
  sessionKey={modalSessionKey}
  on:save={handleModalSave}
  on:cancel={closeModal}
/>
