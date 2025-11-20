export type {
  PostFieldDefinition as CustomFieldDefinition,
  PostSettingSummary as CustomFieldSetSummary,
  CustomFieldType,
} from '@lib/types';

export type RichTextValue = { html: string; json: Record<string, unknown> } | null;

export type ChangeValueDetail = {
  key: string;
  value: unknown;
};

export type FileValue = {
  key: string;
  url: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  alt?: string;
} | null;
