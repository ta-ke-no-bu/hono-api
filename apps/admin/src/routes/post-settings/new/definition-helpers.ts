import type { CustomFieldType } from '@lib/types';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2, 12)}`;
}

export interface DefinitionApiInput {
  type: CustomFieldType | 'repeatable';
  slug: string;
  label: string;
  description?: string | null;
  isRepeatable?: boolean;
  order?: number;
  validation?: unknown;
  config?: unknown;
  children?: DefinitionApiInput[];
}

export interface LocalDefinition {
  id: string;
  parentId: string | null;
  type: CustomFieldType;
  slug: string;
  label: string;
  description: string | null;
  isRepeatable: boolean;
  order: number;
  validation: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  children: LocalDefinition[];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toLocalNode(node: DefinitionApiInput, parentId: string | null, order: number): LocalDefinition {
  const id = generateId();
  const children = Array.isArray(node.children)
    ? node.children.map((child, index) => toLocalNode(child, id, index))
    : [];

  const normalizedType: CustomFieldType = node.type === 'repeatable' ? 'group' : (node.type as CustomFieldType);
  const isRepeatable = node.type === 'repeatable' ? true : Boolean(node.isRepeatable);

  const validation = node.validation;
  const config = node.config;

  const normalizedValidation =
    validation && typeof validation === 'object' && !Array.isArray(validation)
      ? (cloneJson(validation) as Record<string, unknown>)
      : null;

  const normalizedConfig =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (cloneJson(config) as Record<string, unknown>)
      : null;

  return {
    id,
    parentId,
    type: normalizedType,
    slug: node.slug,
    label: node.label,
    description: node.description ?? null,
    isRepeatable,
    order,
    validation: normalizedValidation,
    config: normalizedConfig,
    children,
  };
}

export function toLocalDefinitions(input: DefinitionApiInput[] | null | undefined): LocalDefinition[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }
  return input.map((node, index) => toLocalNode(node, null, index));
}

function normalizeOrdersInternal(nodes: LocalDefinition[], parentId: string | null): LocalDefinition[] {
  return nodes.map((node, index) => ({
    ...node,
    parentId,
    order: index,
    children: normalizeOrdersInternal(node.children ?? [], node.id),
  }));
}

export function normalizeOrders(nodes: LocalDefinition[]): LocalDefinition[] {
  return normalizeOrdersInternal(nodes, null);
}

function toApiNode(node: LocalDefinition, order: number): DefinitionApiInput {
  const children = node.children?.length ? node.children.map((child, index) => toApiNode(child, index)) : undefined;
  const result: DefinitionApiInput = {
    type: node.type,
    slug: node.slug,
    label: node.label,
    description: node.description ?? null,
    order,
    children,
  };

  if (node.type === 'group') {
    if (node.isRepeatable) {
      result.isRepeatable = true;
    }
  }

  if (node.validation && Object.keys(node.validation).length > 0) {
    result.validation = cloneJson(node.validation);
  }

  if (node.config && Object.keys(node.config).length > 0) {
    result.config = cloneJson(node.config);
  }

  return result;
}

export function toApiPayload(nodes: LocalDefinition[]): DefinitionApiInput[] {
  return nodes.map((node, index) => toApiNode(node, index));
}

export function cloneLocalDefinitions(nodes: LocalDefinition[]): LocalDefinition[] {
  return nodes.map((node) => ({
    ...node,
    children: cloneLocalDefinitions(node.children ?? []),
  }));
}
