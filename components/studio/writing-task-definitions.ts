/** Typed task definitions keep headings, accessible names and navigation in step. */
export const WRITING_TASKS = {
  details: { heading: 'Writing details', label: 'Writing details' },
  components: { heading: 'Create widget', label: 'Widget generator' },
  history: { heading: 'Revision history', label: 'Revision history' },
} as const satisfies Record<string, { heading: string; label: string }>;

export type WritingTask = 'write' | keyof typeof WRITING_TASKS;
