/** Thrown when a Micropub post cannot be stored anywhere durable. */
export class MicropubStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MicropubStorageError';
  }
}

/** One file written with one commit. */
export class MicropubConflictError extends MicropubStorageError {}

export interface GitHubFileWrite {
  path: string;
  content: string;
  message: string;
  /** The blob being replaced. Omitted for a new file. */
  sha?: string;
}

/** A writing file as storage holds it. */
export interface StoredWriting {
  slug: string;
  /** Repository-relative path of the writing content. */
  path: string;
  source: string;
  /** The blob SHA GitHub needs to change the file; absent locally. */
  sha?: string;
  privateDocumentId?: string;
  privateRevisionId?: string;
}
