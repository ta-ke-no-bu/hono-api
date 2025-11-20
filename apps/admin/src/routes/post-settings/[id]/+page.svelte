<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import { page } from '$app/stores';
  import DefinitionEditor from '@lib/components/custom-fields/DefinitionEditor.svelte';
  import type { CustomFieldDefinition, FieldType } from '@lib/types';
  import Sortable from 'sortablejs';
  import { onDestroy, onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { quintOut } from 'svelte/easing';
  import type { PageData } from './$types';

  export let data: PageData;
  const pageStore = page;

  type UpdateActionState = {
    success?: boolean;
    action?: string;
    message?: string;
    fields?: {
      name: string;
      slug: string;
      status: string;
      description: string;
    };
  } | null;

  let actionState: UpdateActionState;
  $: actionState = $pageStore.form as UpdateActionState;

  let name = data.postSetting.name;
  let slug = data.postSetting.slug;
  let status = data.postSetting.status;
  let description = data.postSetting.description ?? '';

  function cloneDeep<T>(value: T): T {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  let originalDefinitionsRef = data.postSetting.definitions;
  let definitions: CustomFieldDefinition[] = originalDefinitionsRef ? cloneDeep(originalDefinitionsRef) : [];
  $: if (data.postSetting.definitions && data.postSetting.definitions !== originalDefinitionsRef) {
    originalDefinitionsRef = data.postSetting.definitions;
    definitions = cloneDeep(data.postSetting.definitions);
  }
  let selectedDefinition: CustomFieldDefinition | null | undefined;
  let editorSessionKey = 0;
  let defaultParentId: string | null = null;
  let definitionFeedback: { type: 'success' | 'error'; message: string } | null = null;

  const fieldTypes: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'テキスト' },
    { value: 'richText', label: 'リッチテキスト' },
    { value: 'date', label: '日付' },
    { value: 'file', label: 'ファイル' },
    { value: 'select', label: 'セレクトボックス' },
    { value: 'checkbox', label: 'チェックボックス' },
    { value: 'group', label: 'グループ' },
  ];

  type DefinitionListItem = {
    definition: CustomFieldDefinition;
    depth: number;
    parentId: string | null;
  };

  const buildDefinitionList = (
    nodes: CustomFieldDefinition[] | undefined,
    depth = 0,
    parentId: string | null = null,
  ): DefinitionListItem[] => {
    if (!nodes || nodes.length === 0) {
      return [];
    }
    return nodes.flatMap((node) => {
      const current: DefinitionListItem = { definition: node, depth, parentId };
      return [current, ...buildDefinitionList(node.children, depth + 1, node.id)];
    });
  };

  let definitionList: DefinitionListItem[];
  $: definitionList = buildDefinitionList(definitions);

  let parentOptions: { id: string; label: string; depth: number }[];
  $: parentOptions = definitionList
    .filter(({ definition }) => definition.type === 'group')
    .map(({ definition, depth }) => ({ id: definition.id, label: definition.label, depth }));

  const clearDefinitionFeedback = () => {
    definitionFeedback = null;
  };

  const closeEditor = () => {
    clearDefinitionFeedback();
    selectedDefinition = undefined;
    defaultParentId = null;
  };

  const selectDefinition = (def: CustomFieldDefinition) => {
    clearDefinitionFeedback();
    if (selectedDefinition && def.id === selectedDefinition.id) {
      closeEditor();
      return;
    }
    selectedDefinition = def;
    editorSessionKey++;
    defaultParentId = def.parentId ?? null;
  };

  const addNewDefinition = () => {
    clearDefinitionFeedback();
    const parentCandidate = selectedDefinition && selectedDefinition.type === 'group' ? selectedDefinition.id : null;
    defaultParentId = parentCandidate;
    if (selectedDefinition === null) {
      closeEditor();
      return;
    }
    selectedDefinition = null;
    editorSessionKey++;
  };

  $: {
    if (actionState?.action === 'update' && !actionState.success) {
      const fields = actionState.fields;
      if (fields) {
        name = fields.name;
        slug = fields.slug;
        status = fields.status;
        description = fields.description;
      }
    }
  }

  let currentPath = '';
  $: currentPath = $pageStore.url.pathname;

  let listContainer: HTMLDivElement | null = null;
  let sortableInstance: Sortable | null = null;
  let reorderFlashId: string | null = null;
  let reorderFlashTimer: ReturnType<typeof setTimeout> | undefined;

  let showDeleteDefinitionModal = false;
  let deleteDefinitionTarget: DefinitionListItem | null = null;
  let deleteDefinitionConfirmation = '';
  let deleteDefinitionError: string | null = null;
  let deleteDefinitionConfirmed = false;

  const openDeleteDefinitionModal = (item: DefinitionListItem) => {
    deleteDefinitionTarget = item;
    deleteDefinitionConfirmation = '';
    deleteDefinitionError = null;
    showDeleteDefinitionModal = true;
  };

  const closeDeleteDefinitionModal = () => {
    showDeleteDefinitionModal = false;
    deleteDefinitionTarget = null;
    deleteDefinitionConfirmation = '';
    deleteDefinitionError = null;
    deleteDefinitionConfirmed = false;
  };

  $: {
    if (actionState?.action === 'deleteDefinition') {
      if (actionState.success) {
        closeDeleteDefinitionModal();
        closeEditor();
      } else if (actionState?.message) {
        deleteDefinitionError = actionState.message;
        if (deleteDefinitionTarget) {
          showDeleteDefinitionModal = true;
        }
      }
    }
    if (actionState?.action === 'createDefinition' && actionState.success) {
      closeEditor();
    }
    if (actionState?.action === 'updateDefinition' && actionState.success) {
      closeEditor();
    }
  }

  $: {
    if (actionState && (actionState.action === 'createDefinition' || actionState.action === 'updateDefinition')) {
      const fallbackMessage =
        actionState.action === 'createDefinition'
          ? 'フィールド定義の作成結果を確認してください。'
          : 'フィールド定義の更新結果を確認してください。';
      if (actionState.success) {
        definitionFeedback = {
          type: 'success',
          message: actionState.message ?? fallbackMessage,
        };
      } else if (actionState.message) {
        definitionFeedback = { type: 'error', message: actionState.message };
      } else {
        definitionFeedback = { type: 'error', message: fallbackMessage };
      }
    }
  }

  $: deleteDefinitionConfirmed = Boolean(
    deleteDefinitionTarget && deleteDefinitionConfirmation.trim() === deleteDefinitionTarget.definition.slug,
  );

  $: if (actionState && actionState.action !== 'deleteDefinition' && deleteDefinitionError) {
    deleteDefinitionError = null;
  }

  const findSiblingContainer = (
    nodes: CustomFieldDefinition[],
    parentId: string | null,
  ): { siblings: CustomFieldDefinition[] } | null => {
    if (parentId === null) {
      return { siblings: nodes };
    }
    for (const node of nodes) {
      if (node.id === parentId) {
        if (!Array.isArray(node.children)) {
          node.children = [];
        }
        return { siblings: node.children as CustomFieldDefinition[] };
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        const result = findSiblingContainer(node.children as CustomFieldDefinition[], parentId);
        if (result) {
          return result;
        }
      }
    }
    return null;
  };

  const reorderUsingOrderedIds = (parentId: string | null, orderedIds: string[]) => {
    const clone = cloneDeep(definitions) as CustomFieldDefinition[];
    const container = findSiblingContainer(clone, parentId);
    if (!container) {
      return null;
    }
    const siblings = container.siblings;
    if (siblings.length !== orderedIds.length) {
      return null;
    }
    const lookup = new Map(siblings.map((node) => [node.id, node]));
    const orderedSiblings: CustomFieldDefinition[] = [];
    for (const id of orderedIds) {
      const match = lookup.get(id);
      if (!match) {
        return null;
      }
      orderedSiblings.push(match);
    }
    container.siblings.splice(0, siblings.length, ...orderedSiblings);
    definitions = clone;
    return orderedSiblings.map((node, order) => ({ id: node.id, order }));
  };

  onMount(() => {
    if (!listContainer) {
      return;
    }
    sortableInstance = new Sortable(listContainer, {
      animation: 180,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-active',
      forceFallback: true,
      fallbackTolerance: 5,
      onMove: (event) => {
        const fromParent = event.dragged?.dataset.parentId ?? '';
        const toParent = event.related?.dataset.parentId ?? '';
        if (fromParent !== toParent) {
          return false;
        }
        return true;
      },
      onEnd: async (event) => {
        const draggedElement = event.item as HTMLElement | undefined;
        if (!draggedElement) {
          return;
        }
        const parentId = draggedElement.dataset.parentId ?? '';
        const definitionId = draggedElement.dataset.id ?? '';
        if (!definitionId) {
          return;
        }

        const snapshot = cloneDeep(definitions) as CustomFieldDefinition[];
        const siblingElements = Array.from(
          listContainer?.querySelectorAll<HTMLElement>('.definition-item') ?? [],
        ).filter((el) => (el.dataset.parentId ?? '') === parentId);
        const orderedIds = siblingElements.map((el) => el.dataset.id ?? '').filter(Boolean);
        const reordered = reorderUsingOrderedIds(parentId || null, orderedIds);
        if (!reordered) {
          definitions = snapshot;
          return;
        }

        reorderFlashId = definitionId;
        if (reorderFlashTimer) {
          clearTimeout(reorderFlashTimer);
        }
        reorderFlashTimer = setTimeout(() => {
          reorderFlashId = null;
          reorderFlashTimer = undefined;
        }, 600);

        const formData = new FormData();
        formData.append('parentId', parentId);
        formData.append('orderedIds', JSON.stringify(reordered.map((entry) => entry.id)));

        let shouldRefresh = false;
        try {
          const response = await fetch('?/reorderDefinition', {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            console.error('Failed to reorder definitions: ', response.status);
            definitions = snapshot;
            shouldRefresh = true;
          }
        } catch (error) {
          console.error('Failed to reorder definitions:', error);
          definitions = snapshot;
          shouldRefresh = true;
        } finally {
          if (shouldRefresh) {
            await invalidate(currentPath);
          }
        }
      },
    });

    return () => {
      sortableInstance?.destroy();
      sortableInstance = null;
    };
  });

  onDestroy(() => {
    if (reorderFlashTimer) {
      clearTimeout(reorderFlashTimer);
    }
    sortableInstance?.destroy();
    sortableInstance = null;
  });
</script>

{#if showDeleteDefinitionModal && deleteDefinitionTarget}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div class="w-full max-w-lg rounded-lg bg-white shadow-xl">
      <div class="flex items-center justify-between border-b border-gray-200 p-4">
        <h2 class="text-lg font-semibold text-gray-900">フィールド定義の削除</h2>
        <button
          type="button"
          class="text-gray-400 transition hover:text-gray-600"
          aria-label="削除ダイアログを閉じる"
          onclick={closeDeleteDefinitionModal}
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            ></path>
          </svg>
        </button>
      </div>
      <form method="POST" action="?/deleteDefinition" use:enhance class="flex flex-col" autocomplete="off">
        <input type="hidden" name="id" value={deleteDefinitionTarget.definition.id} />
        <input type="hidden" name="expectedSlug" value={deleteDefinitionTarget.definition.slug} />
        <div class="space-y-4 p-4">
          <p class="text-sm text-gray-600">
            「{deleteDefinitionTarget.definition
              .label}」を削除すると、関連する入力項目もすべて失われます。この操作は取り消せません。
          </p>
          <p class="text-sm text-gray-600">
            削除を続行するには確認としてスラッグ
            <code class="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800"
              >{deleteDefinitionTarget.definition.slug}</code
            >
            を入力してください。
          </p>
          <div class="space-y-1">
            <label for="delete-definition-confirm" class="text-sm font-medium text-gray-700">確認用スラッグ</label>
            <input
              id="delete-definition-confirm"
              name="confirmSlug"
              type="text"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:ring-red-500"
              bind:value={deleteDefinitionConfirmation}
              autocomplete="off"
              oninput={() => {
                deleteDefinitionError = null;
              }}
            />
          </div>
          {#if deleteDefinitionError}
            <p class="text-sm text-red-600">{deleteDefinitionError}</p>
          {/if}
        </div>
        <div class="flex flex-col gap-2 border-t border-gray-200 p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
            onclick={closeDeleteDefinitionModal}
          >
            キャンセル
          </button>
          <button
            type="submit"
            class={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 transition ${
              deleteDefinitionConfirmed ? 'bg-red-600 hover:bg-red-700' : 'cursor-not-allowed bg-red-200 text-red-600'
            }`}
            disabled={!deleteDefinitionConfirmed}
            aria-disabled={!deleteDefinitionConfirmed}
          >
            削除する
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<div class="p-8 space-y-8">
  <div>
    <h1 class="text-3xl font-bold mb-2">投稿設定の編集</h1>
    <p class="text-sm text-gray-600">投稿テンプレートの基本情報とカスタムフィールドを編集します。</p>
  </div>

  <a
    href="/post-settings"
    class="inline-flex items-center rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
  >
    一覧に戻る
  </a>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
    <div class="md:col-span-1 space-y-6">
      <section class="bg-white rounded-lg shadow p-6" aria-labelledby="post-setting-update-heading">
        <h2 id="post-setting-update-heading" class="text-xl font-semibold mb-4">基本情報</h2>
        <form method="POST" action="?/update" class="space-y-4">
          <div class="flex flex-col gap-2">
            <label for="name" class="text-sm font-medium text-gray-700">名称</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxlength="120"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              bind:value={name}
            />
          </div>
          <div class="flex flex-col gap-2">
            <label for="slug" class="text-sm font-medium text-gray-700">スラッグ</label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              maxlength="64"
              pattern="^[a-z0-9\-]+$"
              inputmode="lowercase"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              bind:value={slug}
            />
            <p class="text-xs text-gray-500">半角英数字とハイフンのみ利用できます。</p>
          </div>
          <div class="flex flex-col gap-2">
            <label for="status" class="text-sm font-medium text-gray-700">状態</label>
            <select
              id="status"
              name="status"
              required
              class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              bind:value={status}
            >
              <option value="ACTIVE">有効</option>
              <option value="INACTIVE">無効</option>
            </select>
          </div>
          <div class="flex flex-col gap-2">
            <label for="description" class="text-sm font-medium text-gray-700">説明（任意）</label>
            <textarea
              id="description"
              name="description"
              rows="3"
              maxlength="500"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              bind:value={description}
            ></textarea>
          </div>
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            更新する
          </button>
        </form>
      </section>
    </div>

    <div class="md:col-span-2 space-y-6">
      <section class="bg-white rounded-lg shadow p-6" aria-labelledby="custom-fields-heading">
        <div class="flex justify-between items-center mb-4">
          <h2 id="custom-fields-heading" class="text-xl font-semibold">カスタムフィールド定義</h2>
          <button onclick={addNewDefinition} class="btn-secondary">新規追加</button>
        </div>

        <div class="border rounded-lg" bind:this={listContainer}>
          {#if definitionList.length > 0}
            {#each definitionList as item (item.definition.id)}
              <div
                class={`definition-item flex items-center justify-between border-b p-3 last:border-b-0 transition-all duration-200 ease-out ${
                  reorderFlashId === item.definition.id ? 'recently-reordered' : ''
                }`}
                data-id={item.definition.id}
                data-parent-id={item.definition.parentId ?? ''}
                animate:flip={{ duration: 200, easing: quintOut }}
              >
                <span class="flex items-center gap-3" style={`padding-left: ${item.depth * 16}px;`}>
                  <button
                    type="button"
                    class="drag-handle cursor-grab text-gray-400 transition hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    aria-label={`${item.definition.label}をドラッグして並び替え`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        d="M7 4a1 1 0 011-1h4a1 1 0 010 2H8a1 1 0 01-1-1zM7 10a1 1 0 011-1h4a1 1 0 010 2H8a1 1 0 01-1-1zM7 16a1 1 0 011-1h4a1 1 0 010 2H8a1 1 0 01-1-1z"
                        clip-rule="evenodd"
                      ></path>
                    </svg>
                  </button>
                  <span class="font-medium text-gray-900">{item.definition.label}</span>
                  <span class="text-xs text-gray-500">({item.definition.slug})</span>
                  <span class="text-xs text-gray-400">{item.definition.type}</span>
                </span>
                <div class="flex items-center gap-4 text-sm">
                  <button
                    onclick={() => selectDefinition(item.definition)}
                    class={`hover:underline ${selectedDefinition && item.definition.id === selectedDefinition.id ? 'text-indigo-800 font-semibold' : 'text-indigo-600'}`}
                    >{selectedDefinition && item.definition.id === selectedDefinition.id ? '閉じる' : '編集'}</button
                  >
                  <button
                    type="button"
                    class="text-red-600 hover:underline"
                    onclick={() => openDeleteDefinitionModal(item)}
                  >
                    削除
                  </button>
                </div>
              </div>
            {/each}
          {:else}
            <p class="p-4 text-sm text-gray-500">まだフィールド定義がありません。</p>
          {/if}
        </div>
      </section>

      {#if selectedDefinition !== undefined}
        <section class="bg-white rounded-lg shadow p-6" aria-labelledby="definition-editor-heading">
          <h2 id="definition-editor-heading" class="text-xl font-semibold mb-4">
            {selectedDefinition ? 'フィールド定義の編集' : '新規フィールド定義'}
          </h2>
          {#if definitionFeedback}
            <p
              class={`mb-4 rounded-md border px-4 py-2 text-sm ${
                definitionFeedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {definitionFeedback.message}
            </p>
          {/if}
          <DefinitionEditor
            definition={selectedDefinition}
            postSettingId={data.postSetting.id}
            {parentOptions}
            {fieldTypes}
            sessionKey={editorSessionKey}
            initialParentId={defaultParentId}
            onClose={closeEditor}
          />
        </section>
      {/if}
    </div>
  </div>
</div>

<style>
  .definition-item {
    position: relative;
    transition:
      transform 0.18s cubic-bezier(0.22, 1, 0.36, 1),
      background-color 0.25s ease,
      box-shadow 0.25s ease;
    will-change: transform;
  }

  .recently-reordered {
    background-color: rgba(224, 231, 255, 0.6);
  }

  .sortable-ghost {
    opacity: 0.7;
    transform: scale(0.98);
  }

  .sortable-chosen {
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18);
  }

  .sortable-active {
    cursor: grabbing;
  }
</style>
