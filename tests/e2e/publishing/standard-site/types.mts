export interface Receipt {
  cleanupSourceFiles?: Record<string, string> | undefined;
  verifierSourceFiles?: Record<string, string> | undefined;
  version: 1;
  started: string;
  did: string;
  pds: string;
  publicationUri: string;
  checks: { name: string; observedAt: string; details?: unknown }[];
  cleanup: 'pending' | 'passed' | 'failed';
  originalPublication: Record<string, unknown> | null;
  publicationVersions?:
    | { value: Record<string, unknown>; cid?: string }[]
    | undefined;
  owned: {
    collection:
      | 'site.standard.publication'
      | 'site.standard.document'
      | 'app.bsky.feed.post';
    rkey: string;
    versions?: { value: Record<string, unknown>; cid?: string }[];
  }[];
  error?: string | undefined;
}
