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

interface MicropubPostTypeConfig {
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

interface MicropubEntryFields {
  properties?: Mf2Properties;
  contentFormat?: 'text' | 'html';
  postStatus?: 'draft' | 'published';
  audio?: string[];
  video?: string[];
  event?: MicropubEvent;
  name?: string;
  summary?: string;
  categories: string[];
  slug?: string;
  published?: Date;
  inReplyTo?: string;
  likeOf?: string;
  repostOf?: string;
  bookmarkOf?: string;
  photos: MicropubPhoto[];
  syndication: string[];
}

export interface RawMicropubEntry extends MicropubEntryFields {
  h: string;
  content?: string;
  rsvp?: string;
  syndicateTo: string[];
}

/** A photo on a Micropub entry: a URL, usually from the media endpoint. */
export interface MicropubPhoto {
  url: string;
  alt?: string;
}

export interface MicropubCreateRequest extends MicropubEntryFields {
  h: 'entry' | 'event';
  content: string;
  postType: MicropubPostType;
  rsvp?: MicropubRsvpStatus;
  /** Requested destinations are intent, not confirmed syndication copies. */
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
