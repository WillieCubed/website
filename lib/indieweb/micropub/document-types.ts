import type { Mf2Properties } from './types';

/*
 * A writing file seen as a Micropub post: its frontmatter and body read as
 * mf2 properties for q=source, and edited in place for an update. An edit
 * rewrites only the frontmatter keys whose values change and keeps every
 * other byte, so hand-written formatting, comments, line endings, and keys
 * Micropub knows nothing about (series, featured, featuredImage) survive.
 */

/** A request this server understood but cannot carry out, answered with 400. */
export class MicropubRequestError extends Error {
  constructor(readonly description: string) {
    super('invalid_request');
    this.name = 'MicropubRequestError';
  }
}

export type { Mf2Value, Mf2Properties } from './types';
export interface Mf2Entry {
  type?: string[];
  properties: Mf2Properties;
}
/** A Micropub update, with `delete` split into its two forms. */
export interface MicropubUpdate {
  replace: Mf2Properties;
  add: Mf2Properties;
  /** Properties to remove whole: `"delete": ["category"]`. */
  deleteProperties: string[];
  /** Values to remove: `"delete": { "category": ["indieweb"] }`. */
  deleteValues: Mf2Properties;
}
export type Frontmatter = Record<string, unknown>;
export interface Block {
  /** The top-level key this block sets; absent for comments and blank lines. */
  key?: string;
  /** Each line with its own line ending. */
  lines: string[];
}
export interface WritingFile {
  /** The opening fence with its line ending, verbatim. */
  open: string;
  blocks: Block[];
  /** The closing fence with its line ending, verbatim. */
  close: string;
  /** Everything after the closing fence, verbatim. */
  body: string;
  /** The line ending the file uses, for the lines an edit writes. */
  eol: string;
}
