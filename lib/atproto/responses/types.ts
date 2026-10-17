import type { ResponseGroup } from '@/lib/indieweb/webmention/types';

interface ResponseLabel {
  val: string;
  neg?: boolean;
}

export interface ResponseVisibility {
  labels?: ResponseLabel[];
  viewer?: { blockedBy?: boolean; blocking?: string };
}

export interface Profile extends ResponseVisibility {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}
/** The AppView media representation, separate from the repository blob record. */
export interface PostEmbed {
  $type: string;
  alt?: string;
  items?: { $type: string; fullsize?: string; alt?: string }[];
  images?: { fullsize: string; alt?: string }[];
  playlist?: string;
  thumbnail?: string;
  media?: PostEmbed;
  external?: { uri: string; title?: string; description?: string };
}

interface PostRecord {
  text?: string;
  createdAt?: string;
  reply?: { parent?: { uri?: string }; root?: { uri?: string } };
}

export interface Post {
  uri: string;
  cid?: string;
  author: Profile;
  record: PostRecord;
  indexedAt: string;
  labels?: ResponseLabel[];
  embed?: PostEmbed;
}
export interface Thread {
  post?: Post;
  replies?: Thread[];
  $type?: string;
}

/** AppView discovery before each author's current repository record is read. */
export interface ResponseCandidate {
  post: Post;
  type: 'reply' | 'mention' | 'copy';
  parentUri?: string;
}

export interface BlueskyResponseResult {
  groups: ResponseGroup;
  copyUrl?: string;
  replyUrl?: string;
  incomplete?: boolean;
}

export interface RefreshedBlueskyCandidates {
  posts: Map<string, Post>;
  incomplete: boolean;
}

export interface BlueskyLike {
  actor: Profile;
  createdAt: string;
  indexedAt: string;
}
