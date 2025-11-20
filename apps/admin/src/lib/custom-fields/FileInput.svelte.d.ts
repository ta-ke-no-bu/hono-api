import type { SvelteComponentTyped } from 'svelte';
import type { FileValue } from './types';

type FileInputProps = {
  value?: FileValue;
  label: string;
  description?: string;
};

type FileInputEvents = {
  change: CustomEvent<FileValue>;
};

type FileInputSlots = Record<string, never>;

declare class FileInput extends SvelteComponentTyped<FileInputProps, FileInputEvents, FileInputSlots> {}

export default FileInput;
