export interface Profile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  labels?: { val: string; neg?: boolean }[];
  viewer?: { blockedBy?: boolean; blocking?: string };
}
export interface Post {
  uri: string;
  cid?: string;
  author: Profile;
  record: {
    text?: string;
    createdAt?: string;
    reply?: { parent?: { uri?: string }; root?: { uri?: string } };
  };
  indexedAt: string;
  labels?: Profile['labels'];
  embed?: {
    $type: string;
    alt?: string;
    items?: { $type: string; fullsize?: string; alt?: string }[];
    images?: { fullsize: string; alt?: string }[];
    playlist?: string;
    thumbnail?: string;
    media?: Post['embed'];
    external?: { uri: string; title?: string; description?: string };
  };
}
export interface Thread {
  post?: Post;
  replies?: Thread[];
  $type?: string;
}
