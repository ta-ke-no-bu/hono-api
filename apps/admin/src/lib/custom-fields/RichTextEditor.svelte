<svelte:options runes={false} />
<script lang="ts">
  import { normalizeSpanColorAttributes } from '../utils/normalizeRichTextColor';
  import { Editor, Mark, mergeAttributes } from '@tiptap/core';
  import type { CommandProps, JSONContent, RawCommands } from '@tiptap/core';
  import type { RichTextValue } from './types';
  import Link from '@tiptap/extension-link';
  import Placeholder from '@tiptap/extension-placeholder';
  import { Fragment } from '@tiptap/pm/model';
  import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
  import { TextSelection } from '@tiptap/pm/state';
  import type { Transaction } from '@tiptap/pm/state';
  import StarterKit from '@tiptap/starter-kit';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  type ToolbarPreset = 'basic' | 'standard' | 'full';

  export let value: RichTextValue = null;
  export let placeholder = '本文を入力してください…';
  export let toolbarPreset: ToolbarPreset = 'basic';

  const dispatch = createEventDispatcher<{ change: RichTextValue }>();

  const COLOR_PALETTE: string[][] = [
    ['#000000', '#E60000', '#FF9900', '#FFFF00', '#008A00', '#0066CC', '#9933FF'],
    ['#FFFFFF', '#FACCCC', '#FFEBCC', '#FFFFCC', '#CCE8CC', '#CCE0F5', '#EBD6FF'],
    ['#BBBBBB', '#F06666', '#FFC266', '#FFFF66', '#66B966', '#66A3E0', '#C285FF'],
    ['#888888', '#A10000', '#B26B00', '#B2B200', '#006100', '#0047B2', '#6B24B2'],
    ['#444444', '#5C0000', '#663D00', '#666600', '#003700', '#002966', '#3D1466'],
  ];

  const headingLevels: Array<1 | 2 | 3 | 4 | 5 | 6> = [2, 3];

  const TextColorMark = Mark.create({
    name: 'customTextColor',
    excludes: '',

    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            element.getAttribute('data-color')?.trim() ?? element.style?.color?.trim() ?? null,
          renderHTML: (attributes) => {
            if (!attributes.color) {
              return {};
            }
            const colorValue = String(attributes.color).trim();
            const styleValue = attributes.style ? `${attributes.style}; color: ${colorValue}` : `color: ${colorValue}`;
            return { style: styleValue, 'data-color': colorValue };
          },
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: 'span',
          getAttrs: (element) => {
            if (element.hasAttribute('data-color') || element.style?.color) {
              return {};
            }
            return false;
          },
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      const { color, ...rest } = HTMLAttributes;
      if (!color) {
        return ['span', mergeAttributes(rest), 0];
      }
      const merged = mergeAttributes(rest, {
        style: rest.style ? `${rest.style}; color: ${color}` : `color: ${color}`,
        'data-color': color,
      });
      return ['span', merged, 0];
    },

    addCommands() {
      return {
        setCustomTextColor:
          (color: string) =>
          ({ chain }: CommandProps) => {
            const trimmed = color?.trim();
            if (!trimmed) {
              return false;
            }
            return chain().setMark(this.name, { color: trimmed }).run();
          },
        unsetCustomTextColor:
          () =>
          ({ chain }: CommandProps) => chain().unsetMark(this.name).run(),
      } as Partial<RawCommands>;
    },
  });

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

  const decodeHtml = (input: string): string => {
    if (typeof window === 'undefined' || !input || !input.includes('&')) {
      return input;
    }
    const textarea = document.createElement('textarea');
    textarea.innerHTML = input;
    return textarea.value;
  };

  const fallbackDoc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [],
      },
    ],
  };

  const isProseMirrorDoc = (input: unknown): input is Record<string, unknown> =>
    typeof input === 'object' && input !== null && (input as { type?: string }).type === 'doc';

  type ValueSignature = {
    html: string | null;
    json: string | null;
  };

  const normalizeHtmlContent = (input: string | null | undefined): string =>
    normalizeSpanColorAttributes(decodeHtml(input ?? '')).trim();

  const createSignature = (input: RichTextValue): ValueSignature => {
    if (!input) {
      return { html: null, json: null };
    }
    const doc = ensureDoc(input.json);
    const normalizedHtml = normalizeHtmlContent(input.html);
    return {
      html: normalizedHtml.length > 0 ? normalizedHtml : null,
      json: doc ? JSON.stringify(doc) : null,
    };
  };

  const signaturesEqual = (a: ValueSignature, b: ValueSignature): boolean => {
    if (a.json && b.json) {
      return a.json === b.json;
    }
    return (a.html ?? null) === (b.html ?? null);
  };

  let editorSignature: ValueSignature = { html: null, json: null };
  let lastDispatchedSignature: ValueSignature = { html: null, json: null };
  let isApplyingExternalValue = false;

  let element: HTMLDivElement | null = null;
  let editor: Editor | null = null;
  let isColorModalOpen = false;
  let colorButtonRef: HTMLButtonElement | null = null;
  let colorModalRef: HTMLDivElement | null = null;
  let activeColor: string | null = null;
  let boldActive = false;
  let italicActive = false;
  let linkActive = false;
  let bulletListActive = false;
  let orderedListActive = false;
  let blockquoteActive = false;
  let codeBlockActive = false;
  let headingActive: Record<number, boolean> = Object.fromEntries(headingLevels.map((level) => [level, false]));

  const resetActiveStates = () => {
    activeColor = null;
    boldActive = false;
    italicActive = false;
    linkActive = false;
    bulletListActive = false;
    orderedListActive = false;
    blockquoteActive = false;
    codeBlockActive = false;
    headingActive = Object.fromEntries(headingLevels.map((level) => [level, false]));
  };
  type TextRange = { from: number; to: number };

  let preservedSelection: TextRange | null = null;
  let detachColorModalListener: (() => void) | null = null;

  const preventToolbarMouseDown = (event: MouseEvent) => {
    event.preventDefault();
  };

  const transformPartialBlock = (
    transform: (params: { tr: Transaction; schema: Schema; blockPos: number; blockNode: ProseMirrorNode }) => boolean,
  ): boolean => {
    const editorInstance = editor;
    if (!editorInstance) {
      return false;
    }
    const { selection } = editorInstance.state;
    if (selection.empty) {
      return false;
    }
    const selectionFromNode = selection.$from;
    const selectionToNode = selection.$to;
    if (!selectionFromNode.sameParent(selectionToNode)) {
      return false;
    }
    const parent = selectionFromNode.parent;
    const { schema } = editorInstance;
    const paragraphType = schema.nodes.paragraph;
    if (!parent.isTextblock || parent.type !== paragraphType) {
      return false;
    }
    if (selectionFromNode.parentOffset === 0 && selectionToNode.parentOffset === parent.content.size) {
      return false;
    }

    const { from, to } = selection;

    return editorInstance
      .chain()
      .focus()
      .command(({ tr, dispatch }) => {
        tr.split(to);
        const mappedFromAfterFirstSplit = tr.mapping.map(from);
        tr.split(mappedFromAfterFirstSplit);
        const mappedFromFinal = tr.mapping.map(from);
        const startResolved = tr.doc.resolve(mappedFromFinal);
        const blockPos = startResolved.before();
        if (blockPos === null || blockPos < 0) {
          return false;
        }
        const blockNode = tr.doc.nodeAt(blockPos);
        if (!blockNode) {
          return false;
        }
        const succeeded = transform({ tr, schema, blockPos, blockNode });
        if (!succeeded) {
          return false;
        }
        const updatedNode = tr.doc.nodeAt(blockPos);
        if (!updatedNode) {
          return false;
        }
        const selectionStart = blockPos + 1;
        const selectionEnd = blockPos + updatedNode.nodeSize - 1;
        tr.setSelection(TextSelection.create(tr.doc, selectionStart, selectionEnd));
        dispatch(tr.scrollIntoView());
        return true;
      })
      .run();
  };

  const ensureDoc = (input: unknown) => {
    if (!isProseMirrorDoc(input)) {
      return null;
    }
    const plain = toPlain(input);
    return isProseMirrorDoc(plain) ? plain : null;
  };

  const refreshActiveMarks = () => {
    const nextHeading: Record<number, boolean> = {};
    if (!editor) {
      resetActiveStates();
      return;
    }

    boldActive = editor.isActive('bold');
    italicActive = editor.isActive('italic');
    linkActive = editor.isActive('link');
    bulletListActive = editor.isActive('bulletList');
    orderedListActive = editor.isActive('orderedList');
    blockquoteActive = editor.isActive('blockquote');
    codeBlockActive = editor.isActive('codeBlock');
    for (const level of headingLevels) {
      nextHeading[level] = editor.isActive('heading', { level });
    }
    headingActive = nextHeading;
  };

  const updateActiveColor = () => {
    if (!editor) {
      resetActiveStates();
      return;
    }
    const attributes = editor.getAttributes('customTextColor');
    const candidate = attributes?.color;
    activeColor = typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
    refreshActiveMarks();
  };

  const applyValueToEditor = (nextValue: RichTextValue) => {
    const targetSignature = createSignature(nextValue);
    if (!editor) {
      editorSignature = targetSignature;
      lastDispatchedSignature = targetSignature;
      return;
    }

    if (signaturesEqual(targetSignature, editorSignature)) {
      lastDispatchedSignature = targetSignature;
      return;
    }

    const doc = ensureDoc(nextValue?.json ?? null);
    const htmlContent = targetSignature.html;

    isApplyingExternalValue = true;
    if (doc) {
      editor.commands.setContent(doc, { emitUpdate: false });
    } else if (htmlContent) {
      editor.commands.setContent(htmlContent, { emitUpdate: false });
    } else {
      editor.commands.setContent(structuredClone(fallbackDoc), { emitUpdate: false });
    }
    lastDispatchedSignature = targetSignature;
  };

  onMount(() => {
    const resolvedValue = value;
    const initialDoc = ensureDoc(resolvedValue?.json ?? null);
    const initialHtml = normalizeHtmlContent(resolvedValue?.html);
    const initialContent = initialDoc
      ? structuredClone(initialDoc)
      : initialHtml
        ? initialHtml
        : structuredClone(fallbackDoc);

    const instance = new Editor({
      element,
      extensions: [
        StarterKit,
        TextColorMark,
        Placeholder.configure({ placeholder }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        }),
      ],
      content: initialContent,
      onUpdate: () => {
        const rawHtml = instance.getHTML();
        const normalizedHtml = normalizeSpanColorAttributes(rawHtml).trim();
        const json = instance.getJSON();

        let jsonString: string | null = null;
        try {
          jsonString = JSON.stringify(json);
        } catch {
          jsonString = null;
        }

        const nextSignature: ValueSignature = {
          html: normalizedHtml.length ? normalizedHtml : null,
          json: jsonString,
        };

        editorSignature = nextSignature;

        if (isApplyingExternalValue) {
          lastDispatchedSignature = nextSignature;
          isApplyingExternalValue = false;
          updateActiveColor();
          return;
        }

        if (!signaturesEqual(nextSignature, lastDispatchedSignature)) {
          dispatch('change', { html: normalizedHtml, json });
          lastDispatchedSignature = nextSignature;
        }

        updateActiveColor();
      },
      onSelectionUpdate: () => {
        updateActiveColor();
      },
      onFocus: () => {
        updateActiveColor();
      },
      onBlur: () => {
        resetActiveStates();
      },
    });
    editor = instance;

    const initialJson = instance.getJSON();
    let initialJsonString: string | null = null;
    try {
      initialJsonString = JSON.stringify(initialJson);
    } catch {
      initialJsonString = null;
    }
    const initialHtmlSignature = normalizeSpanColorAttributes(instance.getHTML()).trim();
    editorSignature = {
      html: initialHtmlSignature.length ? initialHtmlSignature : null,
      json: initialJsonString,
    };
    lastDispatchedSignature = editorSignature;

    updateActiveColor();
  });

  $: {
    if (editor) {
      applyValueToEditor(value);
    } else {
      lastDispatchedSignature = createSignature(value);
    }
  }

  // 一時的に$effectを無効化して循環参照を防ぐ
  // $effect(() => {
  //   if (!editor) {
  //     return;
  //   }
  //   const currentValue = value;
  //   if (isProseMirrorDoc(currentValue?.json)) {
  //     const targetDoc = ensureDoc(currentValue?.json) ?? fallbackDoc;
  //     const currentDoc = editor.getJSON();
  //     if (!docsEqual(currentDoc, targetDoc)) {
  //       editor.commands.setContent(toPlain(targetDoc), false);
  //     }
  //     return;
  //   }

  //   const rawHtml = currentValue?.html ?? '';
  //   const html = normalizeSpanColorAttributes(decodeHtml(rawHtml));
  //   const currentHtml = editor.getHTML();
  //   if (currentHtml !== html) {
  //     editor.commands.setContent(html || '<p></p>', false);
  //   }
  // });

  onDestroy(() => {
    detachColorModalListener?.();
    if (editor) {
      editor.destroy();
      editor = null;
    }
  });

  let showStandardToolbar = toolbarPreset === 'standard' || toolbarPreset === 'full';
  let showFullToolbar = toolbarPreset === 'full';

  $: showStandardToolbar = toolbarPreset === 'standard' || toolbarPreset === 'full';
  $: showFullToolbar = toolbarPreset === 'full';

  function toggleBold() {
    if (!editor) {
      return;
    }
    editor.chain().focus().toggleBold().run();
    refreshActiveMarks();
  }

  function toggleItalic() {
    if (!editor) {
      return;
    }
    editor.chain().focus().toggleItalic().run();
    refreshActiveMarks();
  }

  function promptUrl() {
    const current = editor?.getAttributes('link')?.href ?? '';
    const result = window.prompt('リンクURLを入力してください', current ?? '');
    if (!result) {
      return null;
    }
    try {
      const trimmed = result.trim();
      if (!trimmed) {
        return null;
      }
      const url = new URL(trimmed, window.location.origin);
      return url.href;
    } catch {
      window.alert('有効なURLを入力してください');
      return null;
    }
  }

  function setLink() {
    if (!editor) return;
    const href = promptUrl();
    if (!href) {
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  function unsetLink() {
    editor?.chain().focus().unsetLink().run();
  }

  function toggleBulletList() {
    if (!editor) {
      return;
    }
    const handled = transformPartialBlock(({ tr, schema, blockPos, blockNode }) => {
      const paragraphType = schema.nodes.paragraph;
      const listItemType = schema.nodes.listItem;
      const bulletListType = schema.nodes.bulletList;
      if (!paragraphType || !listItemType || !bulletListType) {
        return false;
      }
      const paragraph = blockNode.copy(blockNode.content);
      const listItem = listItemType.create(null, Fragment.from(paragraph));
      const listNode = bulletListType.create(null, Fragment.from(listItem));
      tr.replaceWith(blockPos, blockPos + blockNode.nodeSize, listNode);
      return true;
    });
    if (handled) {
      return;
    }
    editor.chain().focus().toggleBulletList().run();
    refreshActiveMarks();
  }

  function toggleOrderedList() {
    if (!editor) {
      return;
    }
    const handled = transformPartialBlock(({ tr, schema, blockPos, blockNode }) => {
      const paragraphType = schema.nodes.paragraph;
      const listItemType = schema.nodes.listItem;
      const orderedListType = schema.nodes.orderedList;
      if (!paragraphType || !listItemType || !orderedListType) {
        return false;
      }
      const paragraph = blockNode.copy(blockNode.content);
      const listItem = listItemType.create(null, Fragment.from(paragraph));
      const listNode = orderedListType.create(null, Fragment.from(listItem));
      tr.replaceWith(blockPos, blockPos + blockNode.nodeSize, listNode);
      return true;
    });
    if (handled) {
      return;
    }
    editor.chain().focus().toggleOrderedList().run();
    refreshActiveMarks();
  }

  function toggleHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
    if (!editor) {
      return;
    }

    const handled = transformPartialBlock(({ tr, schema, blockPos, blockNode }) => {
      const headingType = schema.nodes.heading;
      if (!headingType) {
        return false;
      }
      if (!blockNode.textContent.trim()) {
        return false;
      }
      tr.setNodeMarkup(blockPos, headingType, { level });
      return true;
    });
    if (handled) {
      return;
    }
    editor.chain().focus().toggleHeading({ level }).run();
    refreshActiveMarks();
  }

  function toggleBlockquote() {
    if (!editor) {
      return;
    }
    const handled = transformPartialBlock(({ tr, schema, blockPos, blockNode }) => {
      const paragraphType = schema.nodes.paragraph;
      const blockquoteType = schema.nodes.blockquote;
      if (!paragraphType || !blockquoteType) {
        return false;
      }
      const paragraphNode = blockNode.copy(blockNode.content);
      const blockquoteNode = blockquoteType.create(null, Fragment.from(paragraphNode));
      tr.replaceWith(blockPos, blockPos + blockNode.nodeSize, blockquoteNode);
      return true;
    });
    if (handled) {
      return;
    }
    editor.chain().focus().toggleBlockquote().run();
    refreshActiveMarks();
  }

  function toggleCodeBlock() {
    if (!editor) {
      return;
    }
    const handled = transformPartialBlock(({ tr, schema, blockPos, blockNode }) => {
      const codeBlockType = schema.nodes.codeBlock;
      if (!codeBlockType) {
        return false;
      }
      const textContent = blockNode.textContent.replace(/\u00A0/g, ' ');
      const codeNode = codeBlockType.create(null, schema.text(textContent));
      tr.replaceWith(blockPos, blockPos + blockNode.nodeSize, codeNode);
      return true;
    });
    if (handled) {
      return;
    }
    editor.chain().focus().toggleCodeBlock().run();
    refreshActiveMarks();
  }

  function insertHorizontalRule() {
    editor?.chain().focus().setHorizontalRule().run();
  }

  function insertHardBreak() {
    editor?.chain().focus().setHardBreak().run();
  }

  const openColorModal = () => {
    if (editor) {
      const { from, to } = editor.state.selection;
      preservedSelection = { from, to };
    } else {
      preservedSelection = null;
    }
    isColorModalOpen = true;
  };

  const closeColorModal = () => {
    isColorModalOpen = false;
    preservedSelection = null;
    requestAnimationFrame(() => colorButtonRef?.focus({ preventScroll: true }));
  };

  const clampRange = (range: TextRange | null): TextRange | null => {
    if (!editor || !range) {
      return null;
    }
    const docSize = editor.state.doc.content.size;
    const from = Math.max(0, Math.min(range.from, docSize));
    const to = Math.max(0, Math.min(range.to, docSize));
    if (from > to) {
      return { from: to, to: from };
    }
    return { from, to };
  };

  const applyColor = (color: string) => {
    if (!editor) return;
    const trimmedColor = color.trim();
    if (!trimmedColor) {
      preservedSelection = null;
      return;
    }
    const selectedRange = clampRange(preservedSelection);
    const chain = editor.chain().focus();
    if (selectedRange) {
      chain.setTextSelection(selectedRange);
    }
    chain.extendMarkRange('customTextColor').setCustomTextColor(trimmedColor).run();
    preservedSelection = null;
    updateActiveColor();
  };

  const clearColor = () => {
    if (!editor) return;
    const selectedRange = clampRange(preservedSelection);
    const chain = editor.chain().focus();
    if (selectedRange) {
      chain.setTextSelection(selectedRange);
    }
    chain.extendMarkRange('customTextColor').unsetCustomTextColor().run();
    preservedSelection = null;
    updateActiveColor();
  };

  const isActiveColor = (color: string) => activeColor?.toLowerCase() === color.toLowerCase();

  $: {
    if (!isColorModalOpen) {
      detachColorModalListener?.();
      detachColorModalListener = null;
    } else {
      detachColorModalListener?.();
      const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          closeColorModal();
        }
      };
      window.addEventListener('keydown', handleKeydown);
      detachColorModalListener = () => {
        window.removeEventListener('keydown', handleKeydown);
      };
      const firstButton = colorModalRef?.querySelector<HTMLButtonElement>('.color-swatch');
      if (firstButton) {
        requestAnimationFrame(() => firstButton.focus({ preventScroll: true }));
      }
    }
  }
</script>

<div class="rich-text-editor">
  <div class="editor-toolbar" role="group" aria-label="リッチテキストツールバー">
    <button
      type="button"
      class={`toolbar-button ${boldActive ? 'is-active' : ''}`}
      aria-pressed={boldActive}
      on:mousedown={preventToolbarMouseDown}
      on:click={toggleBold}
      aria-label="太字を切り替え"
    >
      太字
    </button>
    <button
      type="button"
      class={`toolbar-button ${italicActive ? 'is-active' : ''}`}
      aria-pressed={italicActive}
      on:mousedown={preventToolbarMouseDown}
      on:click={toggleItalic}
      aria-label="斜体を切り替え"
    >
      斜体
    </button>
    <button
      type="button"
      class={`toolbar-button ${linkActive ? 'is-active' : ''}`}
      aria-pressed={linkActive}
      on:mousedown={preventToolbarMouseDown}
      on:click={setLink}
      aria-label="リンク挿入">リンク</button
    >
    <button
      type="button"
      class="toolbar-button"
      on:mousedown={preventToolbarMouseDown}
      on:click={unsetLink}
      aria-label="リンク削除">リンク解除</button
    >
    <button
      type="button"
      class={`toolbar-button ${activeColor ? 'is-active' : ''}`}
      aria-pressed={Boolean(activeColor)}
      bind:this={colorButtonRef}
      on:mousedown={preventToolbarMouseDown}
      on:click={openColorModal}
      aria-label="文字色変更"
    >
      文字色
    </button>
    <button
      type="button"
      class="toolbar-button"
      on:mousedown={preventToolbarMouseDown}
      on:click={clearColor}
      aria-label="文字色をクリア">色クリア</button
    >
    {#if showStandardToolbar}
      <span class="toolbar-divider" aria-hidden="true"></span>
      <button
        type="button"
        class={`toolbar-button ${bulletListActive ? 'is-active' : ''}`}
        aria-pressed={bulletListActive}
        on:mousedown={preventToolbarMouseDown}
        on:click={toggleBulletList}
        aria-label="箇条書きを切り替え"
      >
        箇条書き
      </button>
      <button
        type="button"
        class={`toolbar-button ${orderedListActive ? 'is-active' : ''}`}
        aria-pressed={orderedListActive}
        on:mousedown={preventToolbarMouseDown}
        on:click={toggleOrderedList}
        aria-label="番号付きリストを切り替え"
      >
        番号付き
      </button>
      {#each headingLevels as level}
        <button
          type="button"
          class={`toolbar-button ${(headingActive[level] ?? false) ? 'is-active' : ''}`}
          aria-pressed={headingActive[level] ?? false}
          on:mousedown={preventToolbarMouseDown}
          on:click={() => toggleHeading(level)}
          aria-label={`見出し${level}を切り替え`}
        >
          H{level}
        </button>
      {/each}
    {/if}
    {#if showFullToolbar}
      <span class="toolbar-divider" aria-hidden="true"></span>
      <button
        type="button"
        class={`toolbar-button ${blockquoteActive ? 'is-active' : ''}`}
        aria-pressed={blockquoteActive}
        on:mousedown={preventToolbarMouseDown}
        on:click={toggleBlockquote}
        aria-label="引用を切り替え"
      >
        引用
      </button>
      <button
        type="button"
        class={`toolbar-button ${codeBlockActive ? 'is-active' : ''}`}
        aria-pressed={codeBlockActive}
        on:mousedown={preventToolbarMouseDown}
        on:click={toggleCodeBlock}
        aria-label="コードブロックを切り替え"
      >
        コード
      </button>
      <button
        type="button"
        class="toolbar-button"
        on:mousedown={preventToolbarMouseDown}
        on:click={insertHorizontalRule}
        aria-label="罫線を挿入">罫線</button
      >
      <button
        type="button"
        class="toolbar-button"
        on:mousedown={preventToolbarMouseDown}
        on:click={insertHardBreak}
        aria-label="改行を挿入">改行</button
      >
    {/if}
  </div>
  <div bind:this={element}></div>
</div>

{#if isColorModalOpen}
  <div
    class="color-modal-backdrop"
    role="presentation"
    on:click={(event) => event.target === event.currentTarget && closeColorModal()}
  >
    <div class="color-modal" role="dialog" aria-modal="true" aria-label="文字色を選択" bind:this={colorModalRef}>
      <div class="color-modal-header">
        <h3>文字色を選択</h3>
        <button type="button" class="color-modal-close" aria-label="閉じる" on:click={closeColorModal}>×</button>
      </div>
      <div class="color-palette" role="list">
        {#each COLOR_PALETTE as row}
          <div class="color-row" role="listitem">
            {#each row as swatch}
              <button
                type="button"
                class={`color-swatch ${isActiveColor(swatch) ? 'is-active' : ''}`}
                style={`--swatch-color: ${swatch}`}
                aria-label={`文字色 ${swatch}`}
                on:click={() => {
                  applyColor(swatch);
                  closeColorModal();
                }}
              ></button>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>

  .editor-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .toolbar-button {
    border-radius: var(--radius-md, 0.375rem);
    border-style: var(--tw-border-style, solid);
    border-width: 1px;
    border-color: var(--color-gray-300, #d1d5db);
    background-color: var(--color-white, #ffffff);
    padding-inline: calc(var(--spacing, 0.25rem) * 2);
    padding-block: calc(var(--spacing, 0.25rem) * 1);
    font-size: var(--text-xs, 0.75rem);
    line-height: var(--tw-leading, var(--text-xs--line-height, 1rem));
    --tw-font-weight: var(--font-weight-medium, 500);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-gray-700, #374151);
    --tw-shadow:
      0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1));
    box-shadow:
      var(--tw-inset-shadow, 0 0 #0000), var(--tw-inset-ring-shadow, 0 0 #0000),
      var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
    transition:
      background-color 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .toolbar-button:hover {
    border-color: var(--color-indigo-300, #a5b4fc);
    color: var(--color-indigo-600, #4f46e5);
  }

  .toolbar-button.is-active {
    border-color: var(--color-indigo-500, #6366f1);
    background-color: var(--color-indigo-50, #eef2ff);
    color: var(--color-indigo-600, #4f46e5);
  }

  .toolbar-divider {
    width: 1px;
    height: 1.5rem;
    background-color: var(--color-gray-200, #e5e7eb);
  }

  .rich-text-editor :global(.ProseMirror) {
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    padding: 0.5rem;
    min-height: 150px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  .rich-text-editor :global(.ProseMirror:focus) {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .rich-text-editor :global(.ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: #9ca3af;
    pointer-events: none;
    height: 0;
  }

  .rich-text-editor :global(.ProseMirror h1) {
    font-size: 1.25em;
    font-weight: bold;
  }

  .rich-text-editor :global(.ProseMirror h2) {
    font-size: 1.125em;
    font-weight: bold;
  }

  .rich-text-editor :global(.ProseMirror h3) {
    font-size: 1em;
    font-weight: bold;
  }

  .rich-text-editor :global(.ProseMirror strong),
  .rich-text-editor :global(.ProseMirror b) {
    font-weight: bold;
  }

  .rich-text-editor :global(.ProseMirror em),
  .rich-text-editor :global(.ProseMirror i) {
    font-style: italic;
  }

  .rich-text-editor :global(.ProseMirror u) {
    text-decoration: underline;
  }

  .rich-text-editor :global(.ProseMirror ul) {
    padding-left: 1.5em;
    list-style-type: disc;
  }

  .rich-text-editor :global(.ProseMirror ol) {
    padding-left: 1.5em;
    list-style-type: decimal;
  }

  .rich-text-editor :global(.ProseMirror li) {
    list-style-position: outside;
  }

  .rich-text-editor :global(.ProseMirror blockquote) {
    border-left: 4px solid #ccc;
    padding-left: 1em;
    margin: 1em 0;
    color: #666;
  }

  .rich-text-editor :global(.ProseMirror code) {
    background-color: #eee;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }

  .rich-text-editor :global(.ProseMirror pre) {
    background-color: #f5f5f5;
    padding: 1em;
    border-radius: 5px;
    overflow: auto;
    font-family: 'Courier New', monospace;
  }

  .rich-text-editor :global(.ProseMirror a) {
    color: #007bff;
    text-decoration: underline;
  }

  .rich-text-editor :global(.ProseMirror hr) {
    border: none;
    border-top: 1px solid #ccc;
    margin: 1em 0;
  }

  .color-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 60;
  }

  .color-modal {
    background: #ffffff;
    border-radius: 0.5rem;
    padding: 1rem;
    width: min(320px, 100%);
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.15);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .color-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .color-modal-header h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
  }

  .color-modal-close {
    border: none;
    background: transparent;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    color: #6b7280;
  }

  .color-modal-close:hover {
    color: #111827;
  }

  .color-palette {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .color-row {
    display: flex;
    gap: 0.35rem;
    justify-content: center;
  }

  .color-swatch {
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 9999px;
    border: 1px solid rgba(0, 0, 0, 0.2);
    background-color: var(--swatch-color, #000000);
    cursor: pointer;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.08);
  }

  .color-swatch.is-active {
    border: 2px solid #4f46e5;
  }

  .color-swatch:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 1px;
  }
</style>
