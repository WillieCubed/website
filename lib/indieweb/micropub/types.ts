export type MicropubPostType =
  | 'note'
  | 'article'
  | 'like'
  | 'repost'
  | 'bookmark'
  | 'reply'
  | 'rsvp'
  | 'photo'
  | 'audio'
  | 'video'
  | 'event';

export type MicropubRsvpStatus = 'yes' | 'no' | 'maybe' | 'interested';

export interface MicropubPostTypeConfig {
  type: MicropubPostType;
  name: string;
}

export type Mf2Value = string | Record<string, unknown>;
export type Mf2Properties = Record<string, Mf2Value[]>;

export interface MicropubEvent {
  start?: string;
  end?: string;
  location?: unknown;
}

export interface RawMicropubEntry {
  properties?: Mf2Properties;
  contentFormat?: 'text' | 'html';
  postStatus?: 'draft' | 'published';
  audio?: string[];
  video?: string[];
  event?: MicropubEvent;
  h: string;
  content?: string;
  name?: string;
  summary?: string;
  categories: string[];
  slug?: string;
  published?: Date;
  inReplyTo?: string;
  likeOf?: string;
  repostOf?: string;
  bookmarkOf?: string;
  rsvp?: string;
  photos: MicropubPhoto[];
  syndication: string[];
  syndicateTo: string[];
}

/** A photo on a Micropub entry: a URL, usually from the media endpoint. */
export interface MicropubPhoto {
  url: string;
  alt?: string;
}

export interface MicropubPostTypeSource {
  properties?: Mf2Properties;
  contentFormat?: 'text' | 'html';
  postStatus?: 'draft' | 'published';
  audio?: string[];
  video?: string[];
  event?: MicropubEvent;
  name?: string;
  photos?: MicropubPhoto[];
  inReplyTo?: string;
  likeOf?: string;
  repostOf?: string;
  bookmarkOf?: string;
  rsvp?: string;
}

export interface MicropubCreateRequest {
  properties?: Mf2Properties;
  contentFormat?: 'text' | 'html';
  postStatus?: 'draft' | 'published';
  audio?: string[];
  video?: string[];
  event?: MicropubEvent;
  h: 'entry' | 'event';
  content: string;
  name?: string;
  summary?: string;
  categories: string[];
  slug?: string;
  published?: Date;
  postType: MicropubPostType;
  inReplyTo?: string;
  likeOf?: string;
  repostOf?: string;
  bookmarkOf?: string;
  rsvp?: MicropubRsvpStatus;
  photos: MicropubPhoto[];
  syndication: string[];
  /**
   * Targets chosen with `mp-syndicate-to`, recorded as intent in the post's
   * `syndicateTo` frontmatter. They are not copies, so they never become
   * syndication links.
   */
  syndicateTo: MicropubSyndicationTarget[];
}

/** A place a post can be syndicated to, as `q=syndicate-to` lists it. */
export interface MicropubSyndicationTarget {
  uid: string;
  name: string;
  service: { name: string; url: string };
  user: { name: string; url: string };
}

export interface MicropubCommitOptions {
  repository: string;
  token: string;
  branch: string;
  contentPath: string;
}

export interface MicropubCommitResult {
  sha: string;
  path: string;
  slug: string;
  location: string;
}

/**
 * A Micropub JSON create request. Property values are strings, or objects
 * such as `{ html }` content, `{ value, alt }` photos, and embedded h-cites.
 */
export interface MicropubJsonBody {
  type?: string[];
  properties?: Record<string, unknown[]>;
}

export interface GitHubContentsCommitResponse {
  commit?: {
    sha?: string;
  };
}

export interface MicropubConfigResponse {
  'media-endpoint'?: string;
  'syndicate-to': MicropubSyndicationTarget[];
  'post-types': MicropubPostTypeConfig[];
  /** The `q` values this endpoint answers. */
  q: string[];
}

export interface MicropubRouteEnvironment {
  githubRepository?: string;
  githubToken?: string;
  defaultBranch: string;
  contentPath: string;
}

export interface MicropubCreatedResponse {
  status: 'accepted';
  location: string;
  slug: string;
  path: string;
  commit: string;
}
