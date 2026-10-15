export type WritingPanelTask = 'details' | 'components' | 'history';
export type WritingTask = 'write' | WritingPanelTask;

interface WritingTaskDefinition {
  heading: string;
  label: string;
}

/** Typed task definitions keep headings, accessible names and navigation in step. */
export const WRITING_TASKS = {
  details: { heading: 'Writing details', label: 'Writing details' },
  components: { heading: 'Create widget', label: 'Widget generator' },
  history: { heading: 'Revision history', label: 'Revision history' },
} as const satisfies Record<WritingPanelTask, WritingTaskDefinition>;
