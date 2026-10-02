import { format } from 'date-fns';

import { OWNERS } from './owners';
import type { Project, ProjectStatus } from './schema';

/**
 * The only interface words a project page adds, mirroring the statuses
 * Willie uses in Docket. Everything else on the page is his.
 */
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  paused: 'Paused',
  complete: 'Complete',
  unreleased: 'Unreleased',
  'handed-off': 'Handed off',
  archived: 'Archived',
};

const OPEN: ProjectStatus[] = ['planned', 'active', 'paused'];

export function projectYears(
  project: Pick<Project, 'starts' | 'ends' | 'status'>
): string | undefined {
  const from = project.starts ? format(project.starts, 'yyyy') : undefined;
  const to = project.ends ? format(project.ends, 'yyyy') : undefined;
  if (from && to) return from === to ? from : `${from}–${to}`;
  if (from) return OPEN.includes(project.status) ? `${from}–` : from;
  return to;
}

export function projectFacts(project: Project): string[] {
  const years = projectYears(project);
  return [
    ...project.roles,
    ...project.owners.map((key) => OWNERS[key].name),
    ...(years ? [years] : []),
    STATUS_LABELS[project.status],
  ];
}

/** Host and path, so an unlabeled link names where it goes without new copy. */
export function linkLabel(href: string): string {
  try {
    const url = new URL(href);
    return `${url.host}${url.pathname}`
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  } catch {
    return href;
  }
}
