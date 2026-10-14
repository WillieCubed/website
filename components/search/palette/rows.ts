'use client';

import { type IconName } from '@/components/icons/Icon';

import { groupCommands } from '@/lib/search/palette/commands';
import {
  type ExcerptPart,
  SEARCH_GROUPS,
  type SearchKind,
  type SearchRow,
} from '@/lib/search/palette/search';
import type { Command, CommandKind } from '@/lib/search/palette/types';

const ICONS: Record<CommandKind | SearchKind, IconName> = {
  page: 'arrow-right',
  writing: 'file',
  initiative: 'calendar',
  project: 'compass',
  venture: 'compass',
  music: 'music',
  copy: 'copy',
  mail: 'mail',
  feed: 'rss',
  profile: 'external',
  'theme-dark': 'moon',
  'theme-light': 'sun',
  'theme-system': 'contrast',
  egg: 'terminal',
};
export interface Row {
  key: string;
  title: string;
  detail?: string;
  excerpt?: ExcerptPart[];
  icon: IconName;
  command?: Command;
  search?: SearchRow;
}
interface Section {
  label: string;
  rows: Row[];
}
function commandRow(command: Command): Row {
  return {
    key: command.id,
    title: command.title,
    detail: command.detail,
    icon: ICONS[command.kind],
    command,
  };
}
function searchRow(result: SearchRow): Row {
  return {
    key: result.id,
    title: result.title,
    excerpt: result.excerpt,
    icon: ICONS[result.kind],
    search: result,
  };
}
/**
 * The sections to show: the matching commands in their groups, then search
 * results by type, leaving out any result a command already offers.
 */
export function sectionsFor(
  commands: Command[],
  results: SearchRow[]
): Section[] {
  // A page can be offered by more than one command (the newest writing is
  // both Latest and Go to); the first group to offer it keeps it.
  const offered = new Set<string>();
  const sections: Section[] = groupCommands(commands)
    .map((entry) => ({
      label: entry.group,
      rows: entry.commands
        .filter((command) => {
          if (!command.href) return true;
          if (offered.has(command.href)) return false;
          offered.add(command.href);
          return true;
        })
        .map(commandRow),
    }))
    .filter((section) => section.rows.length > 0);
  for (const { kind, label } of SEARCH_GROUPS) {
    const rows = results
      .filter((result) => result.kind === kind && !offered.has(result.href))
      .map(searchRow);
    if (rows.length > 0) sections.push({ label, rows });
  }
  return sections;
}
