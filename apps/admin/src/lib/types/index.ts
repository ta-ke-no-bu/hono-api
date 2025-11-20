export type FieldType = 'text' | 'richText' | 'date' | 'file' | 'select' | 'checkbox' | 'group' | 'repeatable';

export type PostSettingStatus = 'ACTIVE' | 'INACTIVE';
export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface PostFieldDefinition {
  id: string;
  postSettingId: string;
  parentId: string | null;
  type: FieldType;
  slug: string;
  label: string;
  description: string | null;
  isRepeatable: boolean;
  config?: Record<string, unknown> | null;
  validation?: Record<string, unknown> | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  children?: PostFieldDefinition[];
}

export type CustomFieldDefinition = PostFieldDefinition;
export type CustomFieldType = FieldType;

export interface PostSettingSummary {
  id: string;
  name: string;
  slug: string;
  status: PostSettingStatus;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  definitions?: PostFieldDefinition[];
}

export type CustomFieldSetSummary = PostSettingSummary;

export interface PostWithCategory {
  id: string;
  title: string;
  postSettingId: string;
  postSettingName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  detailEnabled: boolean;
  detailSlug: string | null;
  detailBody: string | null;
  publishedAt: string | null;
  postedAt: string | null;
  status: PostStatus;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId?: number | null;
  updatedByUserId?: number | null;
}
