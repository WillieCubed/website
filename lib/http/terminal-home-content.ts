import { type Entry, entries, products } from '@/lib/home/ventures';
import { site } from '@/lib/site/identity';

import type { TerminalFormat } from './terminal-home-negotiation';

// Leave a margin inside 72-column terminals instead of filling the last cell.
const LINE_WIDTH = 70;
const PAGE_INDENT = '  ';
const DETAIL_INDENT = '    ';
const ANSI_STYLES = { heading: '1;32', name: '1', link: '36' } as const;
type TextStyle = keyof typeof ANSI_STYLES;

function styled(
  text: string,
  style: TextStyle,
  format: TerminalFormat
): string {
  if (format === 'plain') return text;
  // Reset each span so its styling cannot carry into the next shell prompt.
  return `\u001b[${ANSI_STYLES[style]}m${text}\u001b[0m`;
}

function paragraphLines(text: string, indent: string): string[] {
  const width = LINE_WIDTH - indent.length;
  const lines = [''];
  for (const word of text.split(/\s+/)) {
    const last = lines.length - 1;
    if (lines[last] && lines[last].length + word.length + 1 > width)
      lines.push(word);
    else lines[last] += `${lines[last] ? ' ' : ''}${word}`;
  }
  return lines.map((line) => `${indent}${line}`);
}

function visibleEntries(ids: readonly string[]): Entry[] {
  // Affiliations outlive publication choices; only the registry exposes visible work.
  return ids.flatMap((id) => {
    const entry = entries[id];
    return entry === undefined ? [] : [entry];
  });
}

function workLines(entry: Entry, format: TerminalFormat): string[] {
  return [
    `${PAGE_INDENT}${styled(entry.name, 'name', format)}`,
    ...entry.detail.body.flatMap((paragraph) =>
      paragraphLines(paragraph, DETAIL_INDENT)
    ),
    ...entry.detail.links.map(
      (link) => `${DETAIL_INDENT}${styled(link.href, 'link', format)}`
    ),
    '',
  ];
}

function workSection(
  title: string,
  work: readonly Entry[],
  format: TerminalFormat
): string[] {
  if (work.length === 0) return [];
  return [
    `${PAGE_INDENT}${styled(title, 'heading', format)}`,
    '',
    ...work.flatMap((entry) => workLines(entry, format)),
  ];
}

function introduction(format: TerminalFormat): string[] {
  return [
    '',
    `${PAGE_INDENT}${styled(`❖ ${site.shortName}`, 'heading', format)}`,
    `${PAGE_INDENT}${site.name}`,
    '',
    ...paragraphLines(site.description, PAGE_INDENT),
    '',
  ];
}

function directory(format: TerminalFormat): string[] {
  return [
    `${PAGE_INDENT}${styled('Explore', 'heading', format)}`,
    '',
    `${PAGE_INDENT}Writings     ${site.origin}/writings`,
    `${PAGE_INDENT}Projects     ${site.origin}/projects`,
    `${PAGE_INDENT}Initiatives  ${site.origin}/initiatives`,
    '',
  ];
}

function contact(format: TerminalFormat): string[] {
  return [
    `${PAGE_INDENT}${styled('Say hello', 'heading', format)}`,
    '',
    `${PAGE_INDENT}${site.author.email}`,
    ...site.social.map((profile) => `${PAGE_INDENT}${profile.href}`),
    '',
    `${PAGE_INDENT}${site.origin}`,
    `${PAGE_INDENT}For plain text, send Accept: text/plain.`,
    `${PAGE_INDENT}For HTML, send Accept: text/html or X-Original: true.`,
    '',
  ];
}

/**
 * Render the terminal homepage from the existing public identity and work data.
 * Missing registry entries represent hidden work and are omitted, even when the
 * identity still lists that affiliation. An empty work section is omitted too.
 *
 * Plain and ANSI formats contain the same text. ANSI adds only foreground color
 * and bold emphasis, with a reset after every span. The result ends with a newline
 * and requires no provider requests, terminal capabilities, or browser scripts.
 */
export function renderTerminalHome(format: TerminalFormat): string {
  const organizations = visibleEntries(
    site.ventures.map((venture) => venture.key)
  );
  const projects = visibleEntries(['transitmapper', ...Object.keys(products)]);
  return [
    ...introduction(format),
    ...workSection('My work', organizations, format),
    ...workSection('Projects', projects, format),
    ...directory(format),
    ...contact(format),
  ].join('\n');
}
