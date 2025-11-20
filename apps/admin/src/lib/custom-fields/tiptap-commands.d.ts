import type { Commands } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customTextColor: {
      setCustomTextColor: (color: string) => ReturnType;
      unsetCustomTextColor: () => ReturnType;
    };
  }
}
