import { slugToCamelCase } from '@repo/utils';
import type { CustomFieldDefinition } from '../types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPlain<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}

function toPlainRecord(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!isPlainObject(value)) {
    return {};
  }
  const plain = toPlain(value);
  return isPlainObject(plain) ? plain : {};
}

function toValidationObject(input: unknown): Record<string, unknown> {
  if (isPlainObject(input)) {
    return input;
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (isPlainObject(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function resolveMinItems(definition: CustomFieldDefinition): number {
  const validation = definition.validation ?? {};
  if (typeof validation.minItems === 'number') {
    return validation.minItems;
  }
  return validation.required ? 1 : 0;
}

function isLeafField(definition: CustomFieldDefinition | undefined): definition is CustomFieldDefinition {
  return Boolean(definition && definition.type !== 'group' && definition.type !== 'repeatable');
}

function extractLeafValue(definition: CustomFieldDefinition, value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }
  if (definition.type === 'select') {
    if (typeof value === 'object' && value !== null && 'value' in (value as Record<string, unknown>)) {
      const candidate = (value as Record<string, unknown>).value;
      return typeof candidate === 'string' ? candidate : null;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (isPlainObject(value)) {
      const camelKey = slugToCamelCase(definition.slug);
      const candidate = value[camelKey];
      return typeof candidate === 'string' ? candidate : null;
    }
    return null;
  }

  if (definition.type === 'checkbox') {
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  }

  if (definition.type === 'richText') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const html = (value as Record<string, unknown>).html;
      const json = (value as Record<string, unknown>).json;
      if (typeof html === 'string' && json !== undefined) {
        return { html, json };
      }
    }
    return null;
  }

  if (definition.type === 'file') {
    return isPlainObject(value) ? value : null;
  }

  if (definition.type === 'date' || definition.type === 'text') {
    if (typeof value === 'string') {
      return value;
    }
    if (isPlainObject(value)) {
      const camelKey = slugToCamelCase(definition.slug);
      const candidate = value[camelKey];
      return typeof candidate === 'string' ? candidate : '';
    }
    return '';
  }

  return value;
}

export function createDefaultValue(definition: CustomFieldDefinition): unknown {
  switch (definition.type) {
    case 'text':
      return '';
    case 'richText':
      return null;
    case 'date':
      return '';
    case 'file':
      return null;
    case 'select':
      return null;
    case 'checkbox':
      return [];
    case 'group':
      if (definition.isRepeatable) {
        const children = definition.children ?? [];
        const firstChild = children[0];
        const minItems = resolveMinItems(definition);
        const count = Math.max(minItems, 1);
        if (children.length === 1 && isLeafField(firstChild)) {
          const templateValue = toPlain(createDefaultValue(firstChild));
          return Array.from({ length: count }, () => toPlain(templateValue));
        }
        const template = createInitialValues(children);
        return Array.from({ length: count }, () => ({ ...template }));
      }
      return createInitialValues(definition.children ?? []);
    case 'repeatable': {
      const childDefinition = definition.children?.[0];
      if (!childDefinition) {
        return [];
      }
      const minItems = resolveMinItems(definition);
      return Array.from({ length: minItems }, () => createDefaultValue(childDefinition));
    }
    default:
      return null;
  }
}

export function createInitialValues(definitions: CustomFieldDefinition[]): Record<string, unknown> {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    return {};
  }

  const initial = definitions.reduce<Record<string, unknown>>((acc, definition) => {
    const key = slugToCamelCase(definition.slug);
    acc[key] = createDefaultValue(definition);
    return acc;
  }, {});

  return toPlainRecord(initial);
}

export function mergeWithDefaults(
  definitions: CustomFieldDefinition[],
  current: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...toPlainRecord(current) };

  for (const definition of definitions ?? []) {
    const key = slugToCamelCase(definition.slug);

    if (!(key in next) || next[key] === undefined) {
      if (definition.type === 'group') {
        const children = Array.isArray(definition.children) ? definition.children : [];
        const fromFlat: Record<string, unknown> = {};
        let hasFlatValue = false;

        for (const child of children) {
          const childKey = slugToCamelCase(child.slug);
          if (childKey in next) {
            fromFlat[childKey] = toPlain(next[childKey]);
            delete next[childKey];
            hasFlatValue = true;
          }
        }

        if (hasFlatValue) {
          next[key] = toPlain(fromFlat);
        } else {
          next[key] = toPlain(createDefaultValue(definition));
          continue;
        }
      } else {
        next[key] = toPlain(createDefaultValue(definition));
        continue;
      }
    }

    if (definition.type === 'group' && definition.children && !definition.isRepeatable) {
      const existing = isPlainObject(next[key]) ? (next[key] as Record<string, unknown>) : {};
      next[key] = mergeWithDefaults(definition.children, existing);
      continue;
    }

    if (definition.type === 'group' && definition.isRepeatable) {
      const children = definition.children ?? [];
      const firstChild = children[0];
      const rawItems = Array.isArray(next[key]) ? (toPlain(next[key]) as unknown[]) : [];
      const minItems = resolveMinItems(definition);
      const targetLength = Math.max(minItems, rawItems.length || 1);

      if (children.length === 1 && isLeafField(firstChild)) {
        const normalizedItems = rawItems.map((item) => extractLeafValue(firstChild, item));
        while (normalizedItems.length < targetLength) {
          normalizedItems.push(toPlain(createDefaultValue(firstChild)));
        }
        next[key] = normalizedItems;
        continue;
      }

      const template = createInitialValues(children);
      const normalizedItems = rawItems.map((item) => {
        if (isPlainObject(item)) {
          return mergeWithDefaults(children, item);
        }
        return toPlain(template);
      });
      while (normalizedItems.length < targetLength) {
        normalizedItems.push(toPlain(template));
      }
      next[key] = normalizedItems;
      continue;
    }

    if (definition.type === 'repeatable') {
      const items = Array.isArray(next[key]) ? (toPlain(next[key]) as unknown[]) : [];
      const childDefinition = definition.children?.[0];
      if (!childDefinition) {
        next[key] = items;
        continue;
      }
      const minItems = resolveMinItems(definition);
      while (items.length < minItems) {
        const defaultValue = createDefaultValue(childDefinition);
        items.push(toPlain(defaultValue));
      }
      next[key] = items;
      continue;
    }

    if (definition.type === 'richText') {
      const current = next[key];
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        const html = (current as Record<string, unknown>).html;
        const json = (current as Record<string, unknown>).json;
        const isValidHtml = typeof html === 'string';
        const isValidJson = typeof json === 'object' && json !== null;
        next[key] = isValidHtml && isValidJson ? toPlain(current) : null;
      } else {
        next[key] = null;
      }
      continue;
    }

    if (definition.type === 'select') {
      const current = next[key];
      const config = (definition.config as { options?: { label: string; value: string }[] } | null | undefined) ?? null;
      const options = Array.isArray(config?.options) ? config.options : [];
      const normalizeOption = (value: string) => {
        const option = options.find((opt) => opt.value === value);
        if (option) {
          return { value: option.value, label: option.label };
        }
        return { value, label: value };
      };

      if (typeof current === 'string') {
        next[key] = normalizeOption(current);
        continue;
      }
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        const value = (current as Record<string, unknown>).value;
        const label = (current as Record<string, unknown>).label;
        if (typeof value === 'string') {
          next[key] = {
            value,
            label: typeof label === 'string' && label.length > 0 ? label : normalizeOption(value).label,
          };
        } else {
          next[key] = null;
        }
      } else {
        next[key] = null;
      }
      continue;
    }

    if (definition.type === 'checkbox') {
      const config = (definition.config as { options?: { label: string; value: string }[] } | null | undefined) ?? null;
      const options = Array.isArray(config?.options) ? config.options : [];
      const ensureArray = Array.isArray(next[key]) ? (toPlain(next[key]) as unknown[]) : [];
      const normalize = ensureArray.reduce<{ label: string; value: string }[]>((acc, item) => {
        if (typeof item === 'string' && item.length > 0) {
          const option = options.find((opt) => opt.value === item);
          acc.push(option ? { value: option.value, label: option.label } : { value: item, label: item });
          return acc;
        }
        if (item && typeof item === 'object') {
          const value = (item as Record<string, unknown>).value;
          const label = (item as Record<string, unknown>).label;
          if (typeof value === 'string' && value.length > 0) {
            const fallbackOption = options.find((opt) => opt.value === value);
            acc.push({
              value,
              label: typeof label === 'string' && label.length > 0 ? label : (fallbackOption?.label ?? value),
            });
          }
        }
        return acc;
      }, []);
      next[key] = normalize;
    }
  }

  return toPlainRecord(next);
}

export function flattenDefinitions(definitions: CustomFieldDefinition[]): CustomFieldDefinition[] {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    return [];
  }
  const flat: CustomFieldDefinition[] = [];
  const visit = (nodes: CustomFieldDefinition[]) => {
    for (const node of nodes) {
      flat.push(node);
      if (Array.isArray(node.children) && node.children.length > 0) {
        visit(node.children as CustomFieldDefinition[]);
      }
    }
  };
  visit(definitions);
  return flat;
}

function isValueEffectivelyEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((entry) => isValueEffectivelyEmpty(entry));
  }
  if (isPlainObject(value)) {
    return Object.values(value).every((entry) => isValueEffectivelyEmpty(entry));
  }
  return false;
}

function normalizeFields(
  definitions: CustomFieldDefinition[],
  source: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const definition of definitions) {
    const key = slugToCamelCase(definition.slug);
    const rawValue = source[key];
    const nextValue = normalizeFieldValue(definition, rawValue);
    if (nextValue === undefined) {
      continue;
    }
    const validation = toValidationObject(definition.validation);
    const required = Boolean(validation.required);
    if (!required && isValueEffectivelyEmpty(nextValue)) {
      continue;
    }
    normalized[key] = nextValue;
  }
  return normalized;
}

function normalizeFieldValue(definition: CustomFieldDefinition, raw: unknown): unknown {
  const value = toPlain(raw);

  switch (definition.type) {
    case 'text': {
      if (value === undefined || value === null) {
        return '';
      }
      if (typeof value === 'string') {
        return value.trim();
      }
      return String(value).trim();
    }
    case 'richText': {
      if (isPlainObject(value) && typeof value.html === 'string' && value.html.trim().length > 0) {
        return {
          html: value.html.trim(),
          json: value.json ?? null,
        };
      }
      return null;
    }
    case 'date': {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
      }
      return null;
    }
    case 'file': {
      if (
        isPlainObject(value) &&
        typeof value.key === 'string' &&
        value.key.length > 0 &&
        typeof value.url === 'string' &&
        value.url.length > 0
      ) {
        const { key, url } = value;
        const next: Record<string, unknown> = { key, url };
        if (typeof value.filename === 'string') {
          next.filename = value.filename;
        }
        if (typeof value.size === 'number') {
          next.size = value.size;
        }
        if (typeof value.contentType === 'string') {
          next.contentType = value.contentType;
        }
        if (typeof value.alt === 'string') {
          next.alt = value.alt;
        }
        return next;
      }
      return null;
    }
    case 'select': {
      if (isPlainObject(value) && typeof value.value === 'string') {
        const trimmed = value.value.trim();
        return trimmed.length === 0 ? null : trimmed;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
      }
      return null;
    }
    case 'checkbox': {
      if (!Array.isArray(value)) {
        return [];
      }
      const entries = value
        .map((item) => {
          if (typeof item === 'string') {
            const trimmed = item.trim();
            return trimmed.length > 0 ? { value: trimmed, label: trimmed } : null;
          }
          if (isPlainObject(item) && typeof item.value === 'string') {
            const val = item.value.trim();
            if (!val) {
              return null;
            }
            const label = typeof item.label === 'string' && item.label.trim().length > 0 ? item.label.trim() : val;
            return { value: val, label };
          }
          return null;
        })
        .filter((entry): entry is { value: string; label: string } => entry !== null);
      return entries;
    }
    case 'group': {
      const children = Array.isArray(definition.children) ? definition.children : [];
      if (definition.isRepeatable) {
        const items = Array.isArray(value) ? value : [];
        const normalizedItems = items
          .map((item) => {
            let candidate = item;
            if (children.length === 1 && isPlainObject(item)) {
              const childKey = slugToCamelCase(children[0].slug);
              if (childKey in item) {
                candidate = (item as Record<string, unknown>)[childKey];
              }
            }
            if (children.length === 1) {
              const normalizedChild = normalizeFieldValue(children[0], candidate);
              if (normalizedChild === null || normalizedChild === undefined) {
                return null;
              }
              return isValueEffectivelyEmpty(normalizedChild) ? null : normalizedChild;
            }
            if (!isPlainObject(candidate)) {
              return null;
            }
            const normalizedChild = normalizeFields(children, candidate as Record<string, unknown>);
            return isValueEffectivelyEmpty(normalizedChild) ? null : normalizedChild;
          })
          .filter((entry): entry is Record<string, unknown> | unknown => entry !== null);
        return normalizedItems;
      }

      if (!isPlainObject(value)) {
        return null;
      }
      const normalizedGroup = normalizeFields(children, value as Record<string, unknown>);
      return isValueEffectivelyEmpty(normalizedGroup) ? null : normalizedGroup;
    }
    default:
      return value;
  }
}

export function prepareCustomFieldsPayload(
  definitions: CustomFieldDefinition[] | undefined,
  fields: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const source = toPlainRecord(fields ?? {});
  if (!definitions || definitions.length === 0) {
    return source;
  }
  return normalizeFields(definitions, source);
}
