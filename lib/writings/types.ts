/** Link to a syndicated copy of a post on another platform */
export type SyndicationLink = {
  /** Full URL to the syndicated post */
  url: string;
  /** Display name of the platform (e.g., "Threads", "Mastodon", "Twitter") */
  name: string;
};

/**
 * Supported post types for IndieWeb compliance.
 *
 * Content types:
 * - article: Long-form content with a title
 * - note: Short-form content (microblog)
 * - photo: Photo post
 *
 * Interaction types:
 * - like: Indicates appreciation for another post (u-like-of)
 * - repost: Sharing/boosting another post (u-repost-of)
 * - bookmark: Saving a link for later (u-bookmark-of)
 * - rsvp: Response to an event invitation (p-rsvp + u-in-reply-to)
 *
 * Note: "reply" is not a post type - it's determined by the presence of inReplyTo.
 * Any post type can be a reply.
 */
export type PostType =
  | 'article'
  | 'note'
  | 'photo'
  | 'like'
  | 'repost'
  | 'bookmark'
  | 'rsvp';

/** RSVP status values per IndieWeb spec */
export type RSVPStatus = 'yes' | 'no' | 'maybe' | 'interested';

/** RSVP data for event responses */
export type RSVPData = {
  /** URL of the event being responded to */
  eventUrl: string;
  /** RSVP status */
  status: RSVPStatus;
};

export type WritingData = {
  slug: string;
  title: string;
  description: string;
  published: Date;
  lastUpdated: Date;
  tags: string[];
  draft: boolean;
  featuredImage?: string;
  featuredImageAlt?: string;
  readingTime: number;
  /** Series slug - references a series definition in content/series/ */
  series?: {
    slug: string;
    part: number;
  };
  /** Links to syndicated copies on other platforms (POSSE) */
  syndication?: SyndicationLink[];
  /** Type of post for IndieWeb h-entry classification */
  postType: PostType;
  /** URL this post is replying to. When present, marks this as a reply (u-in-reply-to). */
  inReplyTo?: string;

  // Interaction post fields (IndieWeb Level 4)

  /** For like posts: URL being liked (u-like-of) */
  likeOf?: string;
  /** For repost posts: URL being reposted (u-repost-of) */
  repostOf?: string;
  /** For bookmark posts: URL being bookmarked (u-bookmark-of) */
  bookmarkOf?: string;
  /** For RSVP posts: Event and response status */
  rsvp?: RSVPData;
};

export type TOCHeading = {
  id: string;
  text: string;
  level: 2 | 3 | 4;
};

// Series types are now in lib/collections/
// Re-exported from lib/writings/index.ts for backward compatibility
