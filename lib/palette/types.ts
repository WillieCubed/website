/**
 * A place the palette can go, computed on the server from the content
 * loaders and handed to the client as plain data.
 */
export interface PaletteLink {
  title: string;
  href: string;
  /** A quiet second line: a date, the initiative a part belongs to. */
  detail?: string;
}

/**
 * What the palette needs from server-only modules. The layout reads it once
 * per render from a cached loader (lib/palette/data.ts), so the client never
 * imports a file-system loader.
 */
export interface PaletteData {
  /** The newest published writing, when there is one. */
  latestWriting?: PaletteLink;
  /** The running or next part of the newest initiative that has parts. */
  currentPart?: PaletteLink;
  /** Published writings, newest first. */
  writings: PaletteLink[];
  initiatives: PaletteLink[];
  /** Homepage ventures and studio products, each opening its detail view. */
  ventures: PaletteLink[];
}

/**
 * What a command shows inside the palette after it runs: an egg's response,
 * or confirmation that something was copied. Drawn in the mono font like a
 * terminal readout.
 */
export interface Readout {
  /** The first line, such as `HTTP 418 I'm a teapot` or `Copied`. */
  heading: string;
  /** Label and value pairs, such as response headers. */
  fields?: Array<[label: string, value: string]>;
  /** Free text below the fields, such as a response body. */
  body?: string;
  /** True when a request failed; the readout then says what failed. */
  failed?: boolean;
}

export type CommandGroup = 'Latest' | 'Go to' | 'Do';

/** Picks the row's leading icon; the palette maps each kind to one. */
export type CommandKind =
  | 'page'
  | 'writing'
  | 'initiative'
  | 'venture'
  | 'copy'
  | 'mail'
  | 'feed'
  | 'profile'
  | 'theme-light'
  | 'theme-dark'
  | 'theme-system'
  | 'egg';

/** What a command's `run` can ask of the palette. */
export interface CommandContext {
  /** Closes the palette, returning focus to whatever opened it. */
  close: () => void;
}

export interface Command {
  /** Unique across the registry; also the row's DOM id suffix. */
  id: string;
  title: string;
  /** A quiet second line under the title. */
  detail?: string;
  group: CommandGroup;
  /** Extra words that find the command. For an egg, its other names. */
  keywords: string[];
  kind: CommandKind;
  /** A site path the router opens, or an absolute URL. */
  href?: string;
  /**
   * How `href` opens: `router` for pages the app renders, `document` for
   * route handlers such as the feeds, `tab` for other sites.
   */
  opens?: 'router' | 'document' | 'tab';
  /** Runs the command. A returned readout shows in the palette. */
  run?: (context: CommandContext) => Promise<Readout | void> | Readout | void;
  /** Matched only when the whole input equals a name, and never listed. */
  egg?: boolean;
  /** Listed in the empty state. */
  featured?: boolean;
  /** Hides the command while this returns false, such as the current theme. */
  when?: () => boolean;
}
