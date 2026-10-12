export type EditorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: EditorNode[];
};

export interface DraftContent {
  /** Exact imported bytes as UTF-8, retained privately for recovery. */
  originalSource?: string;
  title: string;
  description: string;
  postType: 'article' | 'note';
  tags: string[];
  document: EditorNode;
  /** Complete imported MDX, kept until deliberately edited/exported. */
  frontmatter?: Record<string, unknown>;
  baseFileSha?: string;
}

export interface Revision {
  id: string;
  documentId: string;
  number: number;
  body: DraftContent;
  createdAt: string;
}

export interface Draft {
  id: string;
  slug: string;
  head: Revision;
  liveRevisionId: string | null;
  deletedAt: string | null;
}

export interface Publication {
  id: string;
  documentId: string;
  revisionId: string;
  status: 'publishing' | 'deploying' | 'live' | 'failed';
  /** Commit on the protected branch after GitHub merges the proposal. */
  commit: string | null;
  proposalCommit?: string;
  publicationBranch?: string;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
  publishedFileSha?: string;
  sourceFileSha?: string | null;
  sourcePath?: string;
  proposalInput?: { tree: string; parent: string };
  artifactManifest?: { path: string; sha: string; baseSha: string | null }[];
  rebaseInput?: {
    before: string;
    after?: string;
    tree: string;
    parent: string;
  } | null;
  error: string | null;
  createdAt: string;
}

export interface Generation {
  inferenceKey?: string;
  startedAt?: string;
  id: string;
  documentId: string;
  revisionId: string;
  kind: 'component';
  prompt: string;
  status:
    | 'pending'
    | 'running'
    | 'ready'
    | 'waiting'
    | 'failed'
    | 'accepted'
    | 'rejected';
  result: string | null;
  error: string | null;
}

export interface ComponentProposal {
  id: string;
  name: string;
  description: string;
  version: string;
  source: string;
  portableHtml: string;
  portableText: string;
  properties: Record<string, unknown>;
  example: Record<string, unknown>;
  accessibility: string;
  status: 'proposed' | 'approved';
}

export interface StudioStore {
  list(): Promise<Draft[]>;
  get(id: string): Promise<Draft | null>;
  bySlug(slug: string): Promise<Draft | null>;
  create(slug: string, body: DraftContent): Promise<Draft>;
  save(
    id: string,
    expectedRevisionId: string,
    body: DraftContent
  ): Promise<Draft>;
  revisions(id: string): Promise<Revision[]>;
  remove(id: string, expectedRevisionId: string): Promise<void>;
  revision(id: string): Promise<Revision | null>;
  publication(documentId: string, revisionId: string): Promise<Publication>;
  getPublication(id: string): Promise<Publication | null>;
  updatePublication(id: string, update: Partial<Publication>): Promise<void>;
  generation(
    input: Omit<Generation, 'id' | 'status' | 'result' | 'error'>
  ): Promise<Generation>;
  getGeneration(id: string): Promise<Generation | null>;
  updateGeneration(id: string, update: Partial<Generation>): Promise<void>;
  proposals(): Promise<ComponentProposal[]>;
  proposal(id: string): Promise<ComponentProposal | null>;
  saveProposal(proposal: ComponentProposal): Promise<void>;
}
