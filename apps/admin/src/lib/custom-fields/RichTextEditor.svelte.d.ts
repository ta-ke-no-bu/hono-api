import type { SvelteComponentTyped } from 'svelte';
import type { RichTextValue } from './types';

type ToolbarPreset = 'basic' | 'standard' | 'full';

type RichTextEditorProps = {
  value?: RichTextValue;
  placeholder?: string;
  toolbarPreset?: ToolbarPreset;
};

type RichTextEditorEvents = {
  change: CustomEvent<RichTextValue>;
};

type RichTextEditorSlots = Record<string, never>;

declare class RichTextEditor extends SvelteComponentTyped<RichTextEditorProps, RichTextEditorEvents, RichTextEditorSlots> {}

export default RichTextEditor;
