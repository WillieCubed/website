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

export interface ProjectLinkChip {
  href: string;
  label: string;
  /** The first of the project's own links gets the filled style. */
  primary: boolean;
}

interface Related {
  initiative: { title: string; href: string } | null;
  /** The successor when it is a project on this site. */
  successor: { title: string; href: string } | null;
}

/**
 * Every chip under a project's header, in order: the project's own links,
 * then its initiative, then its successor. The page renders the wrapper
 * only when this is nonempty, so a chip cannot exist without its wrapper.
 *
 * The project's own site leads. When a labeled link already points at it,
 * that link keeps Willie's label instead of a bare host.
 */
export function projectLinkChips(
  project: Pick<Project, 'website' | 'links' | 'successor'>,
  { initiative, successor }: Related
): ProjectLinkChip[] {
  const own = project.website
    ? (project.links.find((link) => link.href === project.website) ?? {
        href: project.website,
      })
    : undefined;
  const chips: ProjectLinkChip[] = [
    ...(own ? [own] : []),
    ...project.links.filter((link) => link !== own),
  ].map((link, index) => ({
    href: link.href,
    label: ('label' in link ? link.label : undefined) ?? linkLabel(link.href),
    primary: index === 0,
  }));
  if (initiative) {
    chips.push({
      href: initiative.href,
      label: initiative.title,
      primary: false,
    });
  }
  if (successor) {
    chips.push({
      href: successor.href,
      label: successor.title,
      primary: false,
    });
  } else if (project.successor?.startsWith('https://')) {
    chips.push({
      href: project.successor,
      label: linkLabel(project.successor),
      primary: false,
    });
  }
  return chips;
}
