import { routedPages, site } from '@/lib/site';
import {
  currentScheme,
  hasSchemeOverride,
  setScheme,
} from '@/lib/theme-preference';

import {
  brewCoffee,
  brewTea,
  clacks,
  copyText,
  fortune,
  mcp,
  securityTxt,
  sudo,
  whoami,
} from './eggs';
import type { Command, CommandGroup, PaletteData, Readout } from './types';

export type { Command, CommandGroup, PaletteData, Readout };

/** The order groups appear in, whatever order the matches came in. */
export const GROUP_ORDER: CommandGroup[] = ['Latest', 'Go to', 'Do'];

/** The feeds, as FeedsButton offers them for the whole site. */
const FEEDS = [
  { label: 'RSS', path: '/feed.xml', featured: true },
  { label: 'Atom', path: '/feed/atom', featured: false },
  { label: 'JSON Feed', path: '/feed/json', featured: false },
];

/** Names the placeholder hints at now and then. */
export const EGG_HINTS = ['brew', 'whoami', 'fortune', 'clacks', 'mcp'];

async function copied(text: string, what: string): Promise<Readout> {
  const ok = await copyText(text);
  return ok
    ? { heading: `Copied ${what}`, body: text }
    : {
        heading: `Could not copy ${what}`,
        body: `The browser refused the clipboard. Here it is to copy by hand:\n${text}`,
        failed: true,
      };
}

function goTo(data: PaletteData): Command[] {
  const pages: Command[] = [
    {
      id: 'go:home',
      title: 'Home',
      group: 'Go to',
      keywords: ['index', 'start', 'landing'],
      kind: 'page',
      href: '/',
      featured: true,
    },
    ...routedPages.map(
      (page): Command => ({
        id: `go:${page.path}`,
        title: page.label,
        detail: page.description,
        group: 'Go to',
        keywords: [],
        kind: 'page',
        href: page.path,
        featured: true,
      })
    ),
  ];
  const ventures = data.ventures.map(
    (venture): Command => ({
      id: `go:${venture.href}`,
      title: venture.title,
      detail: venture.detail,
      group: 'Go to',
      keywords: ['venture'],
      kind: 'venture',
      href: venture.href,
    })
  );
  const initiatives = data.initiatives.map(
    (initiative): Command => ({
      id: `go:${initiative.href}`,
      title: initiative.title,
      detail: initiative.detail,
      group: 'Go to',
      keywords: ['initiative'],
      kind: 'initiative',
      href: initiative.href,
    })
  );
  const writings = data.writings.map(
    (writing): Command => ({
      id: `go:${writing.href}`,
      title: writing.title,
      detail: writing.detail,
      group: 'Go to',
      keywords: ['writing', 'post'],
      kind: 'writing',
      href: writing.href,
    })
  );
  return [...pages, ...ventures, ...initiatives, ...writings];
}

function latest(data: PaletteData): Command[] {
  const commands: Command[] = [];
  if (data.latestWriting) {
    commands.push({
      id: `latest:${data.latestWriting.href}`,
      title: data.latestWriting.title,
      detail: ['Newest writing', data.latestWriting.detail]
        .filter(Boolean)
        .join(' · '),
      group: 'Latest',
      keywords: ['newest', 'writing'],
      kind: 'writing',
      href: data.latestWriting.href,
      featured: true,
    });
  }
  if (data.currentPart) {
    commands.push({
      id: `latest:${data.currentPart.href}`,
      title: data.currentPart.title,
      detail: data.currentPart.detail,
      group: 'Latest',
      keywords: ['current', 'now', 'part'],
      kind: 'initiative',
      href: data.currentPart.href,
      featured: true,
    });
  }
  return commands;
}

function actions(): Command[] {
  return [
    {
      id: 'do:email',
      title: 'Copy email address',
      detail: site.author.email,
      group: 'Do',
      keywords: ['mail', 'contact', 'hello'],
      kind: 'mail',
      featured: true,
      run: () => copied(site.author.email, 'the email address'),
    },
    ...FEEDS.map(
      (feed): Command => ({
        id: `do:feed:${feed.path}`,
        title: `Copy the ${feed.label} feed`,
        detail: feed.path,
        group: 'Do',
        keywords: ['feed', 'subscribe', 'reader', 'rss'],
        kind: 'feed',
        featured: feed.featured,
        run: () =>
          copied(
            new URL(feed.path, site.origin).href,
            `the ${feed.label} feed`
          ),
      })
    ),
    {
      id: 'do:theme:dark',
      title: 'Switch to dark',
      group: 'Do',
      keywords: ['theme', 'dark mode', 'night', 'scheme'],
      kind: 'theme-dark',
      featured: true,
      when: () => currentScheme() === 'light',
      run: () => setScheme('dark'),
    },
    {
      id: 'do:theme:light',
      title: 'Switch to light',
      group: 'Do',
      keywords: ['theme', 'light mode', 'day', 'scheme'],
      kind: 'theme-light',
      featured: true,
      when: () => currentScheme() === 'dark',
      run: () => setScheme('light'),
    },
    {
      id: 'do:theme:system',
      title: 'Follow the system theme',
      group: 'Do',
      keywords: ['theme', 'scheme', 'auto', 'light', 'dark'],
      kind: 'theme-system',
      when: () => hasSchemeOverride(),
      run: () => setScheme(null),
    },
    ...site.social.map(
      (profile): Command => ({
        id: `do:profile:${profile.label.toLowerCase()}`,
        title: `Open ${profile.label}`,
        detail: profile.href.replace(/^https:\/\/(www\.)?/, ''),
        group: 'Do',
        keywords: ['social', 'profile', 'elsewhere'],
        kind: 'profile',
        href: profile.href,
        opens: 'tab',
      })
    ),
  ];
}

/**
 * The easter eggs. Each one does something real (lib/palette/eggs.ts), is
 * matched only when the whole input is one of its names, and is never listed.
 */
function eggs(): Command[] {
  let lastFortune: string | undefined;
  const egg = (
    id: string,
    names: [string, ...string[]],
    run: Command['run'],
    extra: Partial<Command> = {}
  ): Command => ({
    id: `egg:${id}`,
    title: names[0],
    group: 'Do',
    keywords: names.slice(1),
    kind: 'egg',
    egg: true,
    run,
    ...extra,
  });
  return [
    egg('brew', ['brew', 'coffee', 'teapot'], brewCoffee),
    egg('tea', ['tea'], brewTea),
    egg('whoami', ['whoami'], whoami),
    egg('fortune', ['fortune'], () => {
      const readout = fortune(lastFortune);
      lastFortune = readout.heading;
      return readout;
    }),
    egg('clacks', ['clacks'], clacks),
    egg('mcp', ['mcp'], mcp),
    egg('llms', ['llms', 'llms.txt'], undefined, {
      href: '/llms.txt',
      opens: 'document',
    }),
    egg('security', ['security', 'security.txt'], securityTxt),
    egg('sudo', ['sudo'], sudo),
    egg('quit', [':q', 'exit'], ({ close }) => close()),
  ];
}

/**
 * Every command the palette knows, from the server's data plus the fixed
 * actions and eggs. Plain data and functions, so later parts can add owner
 * commands without changing the palette.
 */
export function buildCommands(data: PaletteData): Command[] {
  return [...latest(data), ...goTo(data), ...actions(), ...eggs()];
}

/** Lowercase with whitespace collapsed, so matching ignores both. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The egg whose name is the whole input, if there is one. */
export function findEgg(
  commands: Command[],
  query: string
): Command | undefined {
  const typed = normalizeQuery(query);
  if (!typed) return undefined;
  return commands.find(
    (command) =>
      command.egg &&
      [command.title, ...command.keywords].some(
        (name) => name.toLowerCase() === typed
      )
  );
}

function visible(command: Command): boolean {
  return !command.egg && (command.when?.() ?? true);
}

/**
 * The commands to list for the input: the featured ones when it is empty,
 * else every command whose title, detail, or keywords hold each typed word,
 * best matches first. Eggs never appear here, whatever is typed.
 */
export function matchCommands(commands: Command[], query: string): Command[] {
  const typed = normalizeQuery(query);
  const listed = commands.filter(visible);
  if (!typed) return listed.filter((command) => command.featured);

  const words = typed.split(' ');
  const scored: Array<{ command: Command; score: number }> = [];
  for (const command of listed) {
    const title = command.title.toLowerCase();
    const haystack = [title, command.detail ?? '', ...command.keywords]
      .join(' ')
      .toLowerCase();
    if (!words.every((word) => haystack.includes(word))) continue;
    // A title that starts with the input beats one with a word that does,
    // which beats a match somewhere in the detail or keywords.
    const score = title.startsWith(typed)
      ? 3
      : title.split(/\s+/).some((word) => word.startsWith(words[0]))
        ? 2
        : 1;
    scored.push({ command, score });
  }
  // The same page can be both Latest and a Go to entry; typing shows it once.
  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score)
    .map(({ command }) => command)
    .filter((command) => {
      const key = command.href ?? command.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Commands in their groups, in the palette's group order. */
export function groupCommands(
  commands: Command[]
): Array<{ group: CommandGroup; commands: Command[] }> {
  return GROUP_ORDER.map((group) => ({
    group,
    commands: commands.filter((command) => command.group === group),
  })).filter((entry) => entry.commands.length > 0);
}
