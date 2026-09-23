export type WebmentionType =
  | 'like'
  | 'repost'
  | 'reply'
  | 'mention'
  | 'bookmark';

export interface WebmentionAuthor {
  name?: string;
  url?: string;
  photo?: string;
}

export interface Webmention {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  type: WebmentionType;
  author: WebmentionAuthor;
  content?: string;
  publishedAt?: Date;
  receivedAt: Date;
  verifiedAt?: Date;
  isVerified: boolean;
  isApproved: boolean;
}

export interface PublicWebmention {
  id: string;
  source: string;
  target: string;
  type: WebmentionType;
  author: WebmentionAuthor;
  content?: string;
  published?: string;
  received: string;
  verified?: string;
}

export interface PublicWebmentionResponse {
  type: 'webmentions';
  target: string;
  count: number;
  children: PublicWebmention[];
  byType: Record<WebmentionType, PublicWebmention[]>;
}

export interface WebmentionActivity extends Webmention {
  activityDate: Date;
  targetSlug?: string;
}

export interface ActivityFeedIndieWebMetadata {
  type: WebmentionType;
  source: string;
  target: string;
  authorName?: string;
}

export interface ActivityFeedItem {
  id: string;
  title: string;
  description: string;
  url: string;
  published: Date;
  updated?: Date;
  categories: string[];
  indieweb: ActivityFeedIndieWebMetadata;
}

export interface BuildActivityFeedOptions {
  titleForTarget: (targetUrl: string, activity: WebmentionActivity) => string;
}

export interface ActivityFeedRouteConfig {
  title: string;
  description: string;
  feedUrl: string;
  /** The page the activity is about. Defaults to the homepage. */
  alternateUrl?: string;
}

export interface WritingActivityFeedRouteParams {
  slug: string;
}

export interface WritingActivityFeedRouteProps {
  params: Promise<WritingActivityFeedRouteParams>;
}

export interface WebmentionGroup {
  likes: Webmention[];
  reposts: Webmention[];
  replies: Webmention[];
  mentions: Webmention[];
  bookmarks: Webmention[];
}

export interface OutgoingWebmention {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  endpointUrl?: string;
  status: 'pending' | 'sent' | 'failed' | 'no_endpoint';
  responseCode?: number;
  sentAt?: Date;
  createdAt: Date;
}

export interface OutgoingWebmentionRecord {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  contentHash: string;
  status: string;
  sentAt: Date | null;
}

export interface PendingOutgoingWebmention {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  postSlug: string;
}

export interface SendAllWebmentionsRequest {
  slugs?: string[];
  dryRun?: boolean;
}

export interface SentWebmentionSummary {
  targetUrl: string;
  success: boolean;
  error?: string;
}

export interface SendAllWebmentionsWritingResult {
  slug: string;
  results: SentWebmentionSummary[];
}

export interface UpdateVerifiedWebmentionData {
  type: WebmentionType;
  authorName?: string;
  authorUrl?: string;
  authorPhoto?: string;
  content?: string;
  publishedAt?: Date;
  rawMf2?: object;
}

export interface GetAllWebmentionActivitiesOptions {
  limit?: number;
}

export type WebmentionModerationAction = 'approve' | 'reject';

/**
 * The storage calls moderation needs. `approve` and `reject` resolve to
 * false when no row was in a state they could change.
 */
export interface WebmentionModerationStore {
  listPending: () => Promise<Webmention[]>;
  approve: (id: string) => Promise<boolean>;
  reject: (id: string) => Promise<boolean>;
}

/**
 * The storage calls the receiving endpoint's rate limit needs. `hit` records
 * one request for `key` and resolves to the number of requests that key has
 * made in its current window, this one included. `prune` drops keys whose
 * window has ended.
 */
export interface WebmentionRateLimitStore {
  hit: (key: string, windowMs: number) => Promise<number>;
  prune: (windowMs: number) => Promise<void>;
}

export interface WebmentionModerationRequest {
  action: WebmentionModerationAction;
  id: string;
}

export interface WebmentionModerationRouteOptions {
  store: WebmentionModerationStore;
  secret: string | undefined;
}

export type WebmentionModerationCommand =
  | { command: 'list' }
  | { command: WebmentionModerationAction; ids: string[] };

export interface PendingWebmentionSummary {
  id: string;
  source: string;
  target: string;
  type: WebmentionType;
  author?: string;
  content?: string;
  received: string;
  verified: boolean;
}

export interface WebmentionRow {
  id: string;
  source_url: string;
  target_url: string;
  type: string | null;
  author_name: string | null;
  author_url: string | null;
  author_photo: string | null;
  content: string | null;
  published_at: string | Date | null;
  received_at: string | Date;
  verified_at: string | Date | null;
  is_verified: boolean;
  is_approved: boolean;
}

export interface ExtractedWebmentionAuthor {
  name?: string;
  url?: string;
  photo?: string;
}

export interface WebmentionVerificationResult {
  success: boolean;
  type?: WebmentionType;
  author?: ExtractedWebmentionAuthor;
  content?: string;
  publishedAt?: Date;
  error?: string;
  isUpdate?: boolean;
  isDeleted?: boolean;
}

export interface WebmentionTargetRequest {
  sourceUrl: string;
  targetUrl: string;
}

export interface IndieAuthVerificationOptions {
  bearer: string;
  endpoint: string;
  expectedMe: string;
  /** A scope the token must carry; given a list, any one of them passes. */
  requiredScope?: string | string[];
}

export interface IndieAuthTokenResponse {
  me?: string;
  scope?: string;
  client_id?: string;
}

export interface IndieWebJsonError {
  error: string;
  error_description?: string;
}

export type MicropubPostType =
  | 'note'
  | 'article'
  | 'like'
  | 'repost'
  | 'bookmark'
  | 'reply'
  | 'rsvp'
  | 'photo';

export type MicropubRsvpStatus = 'yes' | 'no' | 'maybe' | 'interested';

export interface MicropubPostTypeConfig {
  type: MicropubPostType;
  name: string;
}

export interface RawMicropubEntry {
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
  name?: string;
  photos?: MicropubPhoto[];
  inReplyTo?: string;
  likeOf?: string;
  repostOf?: string;
  bookmarkOf?: string;
  rsvp?: string;
}

export interface MicropubCreateRequest {
  h: 'entry';
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
  /** Targets chosen with `mp-syndicate-to`, recorded as syndication links. */
  syndicateTo: MicropubSyndicationTarget[];
}

/** A place a post can be syndicated to, as `q=syndicate-to` lists it. */
export interface MicropubSyndicationTarget {
  uid: string;
  name: string;
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

export interface MicropubJsonBody {
  type?: string[];
  properties?: Record<string, string[]>;
}

export interface GitHubContentsCommitResponse {
  commit?: {
    sha?: string;
  };
}

export interface MicropubConfigResponse {
  'media-endpoint': string;
  'syndicate-to': MicropubSyndicationTarget[];
  'post-types': MicropubPostTypeConfig[];
}

export interface MicropubRouteEnvironment {
  githubRepository?: string;
  githubToken?: string;
  defaultBranch: string;
  contentPath: string;
  indieAuthTokenEndpoint: string;
}

export interface MicropubCreatedResponse {
  status: 'accepted';
  location: string;
  slug: string;
  path: string;
  commit: string;
}

export interface OEmbedResponse {
  version: '1.0';
  type: 'rich';
  provider_name: string;
  provider_url: string;
  title: string;
  author_name: string;
  author_url: string;
  html: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  cache_age: number;
}

export interface OEmbedBuildOptions {
  targetUrl: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
}

export interface OEmbedHtmlParts {
  title: string;
  description?: string;
  url: string;
}

export interface WebFingerLink {
  rel: string;
  type?: string;
  href: string;
}

export interface WebFingerResponse {
  subject: string;
  aliases: string[];
  links: WebFingerLink[];
}

export interface HostMetaLink {
  rel: string;
  template: string;
}

export interface HostMetaResponse {
  links: HostMetaLink[];
}

export interface JsonResponseInit {
  status?: number;
  headers?: HeadersInit;
}
