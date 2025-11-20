import type { SvelteComponentTyped } from 'svelte';
import type { ChangeValueDetail, CustomFieldDefinition } from './types';

type CustomFieldFieldProps = {
  definition: CustomFieldDefinition;
  value?: unknown;
  path?: string[];
};

type CustomFieldFieldEvents = {
  changeValue: CustomEvent<ChangeValueDetail>;
};

type CustomFieldFieldSlots = Record<string, never>;

declare class CustomFieldField extends SvelteComponentTyped<CustomFieldFieldProps, CustomFieldFieldEvents, CustomFieldFieldSlots> {}

export default CustomFieldField;
