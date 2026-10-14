import type { EditorNode } from '@/lib/studio/types';

export function proseText(node: EditorNode): string {
  return [
    node.text || '',
    node.type === 'mdxSource' ? String(node.attrs?.source || '') : '',
    node.type === 'catalogBlock'
      ? [
          String(node.attrs?.children || ''),
          ...Object.values(
            (node.attrs?.props as Record<string, unknown>) || {}
          ).filter((value) => typeof value === 'string'),
        ].join(' ')
      : '',
    ...(node.content || []).map(proseText),
  ].join(' ');
}
