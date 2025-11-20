export function collapseNestedColorSpans(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    return input;
  }
  let previous = input;
  let current = input;
  const pattern = /<span>\s*(<span[^>]*data-color[^>]*>[\s\S]*?<\/span>)\s*<\/span>/gi;
  do {
    previous = current;
    current = current.replace(pattern, '$1');
  } while (current !== previous);
  return current;
}

export function normalizeSpanColorAttributes(html: string): string {
  if (typeof html !== 'string') {
    return html;
  }

  return collapseNestedColorSpans(
    html.replace(/<span([^>]*)>/gi, (match, rawAttributes) => {
      const attributes = rawAttributes ?? '';
      const styleMatch = attributes.match(/\s*style\s*=\s*"([^"]*)"/i);
      const dataColorMatch = attributes.match(/\s*data-color\s*=\s*"([^"]*)"/i);

      let remaining = attributes;
      const styleValue = styleMatch?.[1] ?? '';
      let color = dataColorMatch?.[1]?.trim() ?? null;

      if (styleMatch) {
        remaining = remaining.replace(styleMatch[0], ' ');
      }
      if (dataColorMatch) {
        remaining = remaining.replace(dataColorMatch[0], ' ');
      }

      if (!color && styleValue) {
        const colorSegment = styleValue
          .split(';')
          .map((segment) => segment.trim())
          .find((segment) => segment.toLowerCase().startsWith('color:'));
        if (colorSegment) {
          const [, value] = colorSegment.split(':');
          color = value?.trim() ?? null;
        }
      }

      if (!color) {
        const hexToken = remaining.match(/#([0-9a-f]{3,8})\b/i);
        if (hexToken) {
          color = `#${hexToken[1]}`;
          remaining = remaining.replace(hexToken[0], ' ');
        }
      }

      if (!color) {
        return match;
      }

      const normalizedColor = color;

      const styleSegments = styleValue
        ? styleValue
            .split(';')
            .map((segment) => segment.trim())
            .filter(Boolean)
            .filter((segment) => !/^color\s*:/i.test(segment))
        : [];

      styleSegments.push(`color: ${normalizedColor}`);
      let normalizedStyle = styleSegments.join('; ');
      if (!normalizedStyle.endsWith(';')) {
        normalizedStyle = `${normalizedStyle};`;
      }

      const otherAttrs = remaining.replace(/\s{2,}/g, ' ').trim();
      const attributeParts = [otherAttrs, `style="${normalizedStyle}"`, `data-color="${normalizedColor}"`]
        .filter((segment) => segment && segment.length > 0)
        .join(' ');

      return `<span${attributeParts.length > 0 ? ` ${attributeParts}` : ''}>`;
    }),
  );
}

export function normalizeOptionalRichText(input: string | null | undefined): string {
  if (typeof input !== 'string') {
    return '';
  }
  if (input.length === 0) {
    return input;
  }
  return normalizeSpanColorAttributes(input);
}
