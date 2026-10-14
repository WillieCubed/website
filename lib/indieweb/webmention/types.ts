import type { RSVPStatus, WritingData } from '@/lib/writings/types';

export type WebmentionType =
  | 'like'
  | 'repost'
  | 'reply'
  | 'mention'
  | 'bookmark'
  | 'rsvp';

export interface WebmentionAuthor {
  name?: string;
  url?: string;
  photo?: string;
}

export interface ResponseMedia {
  kind: 'image' | 'audio' | 'video' | 'file';
  url: string;
  description?: string;
  mimeType?: string;
  poster?: string;
}

export interface PublishingResponse {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  type: WebmentionType;
  author: WebmentionAuthor;
  /** The answer an `rsvp` gave; every answer is stored, even `no`. */
  rsvp?: RSVPStatus;
  /** The citing post's own title, when it has one apart from its text. */
  name?: string;
  /** Plain text, for feeds, search, and moderation. */
  content?: string;
  /** Sanitized markup from the source's `e-content`, for the post to show. */
  contentHtml?: string;
  publishedAt?: Date;
  observedAt?: Date;
  receivedAt: Date;
  origin?: 'indieweb' | 'atproto';
  parentUrl?: string;
  threadDepth?: number;
  sourceAliases?: string[];
  media?: ResponseMedia[];
}

export interface Webmention extends PublishingResponse {
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
  rsvp?: RSVPStatus;
  name?: string;
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

export type ResponseActivity = PublishingResponse & {
  activityDate: Date;
  targetSlug?: string;
  verifiedAt?: Date;
};

export interface ActivityFeedIndieWebMetadata {
  type: WebmentionType;
  source: string;
  target: string;
  authorName?: string;
}

export interface ActivityFeedItem {
  author?: WebmentionAuthor;
  content?: string;
  attachments?: { url: string; mime_type: string; title?: string }[];
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
  titleForTarget: (targetUrl: string, activity: ResponseActivity) => string;
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

export interface WebmentionGroup<T extends PublishingResponse = Webmention> {
  likes: T[];
  reposts: T[];
  replies: T[];
  mentions: T[];
  bookmarks: T[];
  rsvps: T[];
}

export type ResponseGroup = WebmentionGroup<PublishingResponse>;

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

/** The parts of a writing that decide where its webmentions go. */
export type WebmentionSourceWriting = Pick<
  WritingData,
  | 'slug'
  | 'people'
  | 'inReplyTo'
  | 'likeOf'
  | 'repostOf'
  | 'bookmarkOf'
  | 'rsvp'
>;

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
  rsvp?: RSVPStatus;
  authorName?: string;
  authorUrl?: string;
  authorPhoto?: string;
  content?: string;
  contentHtml?: string;
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
 * A verified webmention stored without an author photo, with the h-entry the
 * verifier kept as `raw_mf2_json`.
 */
export interface WebmentionAuthorBackfillRow {
  id: string;
  rawMf2: unknown;
}

/**
 * The storage calls the author photo backfill needs. `setPhoto` resolves to
 * false when the row already has a photo, so a second run changes nothing.
 */
export interface WebmentionAuthorBackfillStore {
  listMissingPhotos: () => Promise<WebmentionAuthorBackfillRow[]>;
  setPhoto: (id: string, photo: string) => Promise<boolean>;
}

export interface WebmentionAuthorBackfillResult {
  /** Mentions that now have the photo their stored entry names. */
  filled: { id: string; photo: string }[];
  /** Mentions whose stored entry names no author photo, left as they were. */
  skipped: string[];
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
  /** Called with the id of each webmention the request approved. */
  onApproved?: (id: string) => void;
}

export type WebmentionModerationCommand =
  | { command: 'list' }
  | { command: WebmentionModerationAction; ids: string[] };

export interface PendingWebmentionSummary {
  id: string;
  source: string;
  target: string;
  type: WebmentionType;
  rsvp?: RSVPStatus;
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
  rsvp: string | null;
  /** `p-name` read from the stored h-entry, not a column of its own. */
  name: string | null;
  content: string | null;
  content_html: string | null;
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
  rsvp?: RSVPStatus;
  author?: ExtractedWebmentionAuthor;
  content?: string;
  contentHtml?: string;
  publishedAt?: Date;
  error?: string;
  isUpdate?: boolean;
  isDeleted?: boolean;
}

export interface WebmentionTargetRequest {
  sourceUrl: string;
  targetUrl: string;
}
