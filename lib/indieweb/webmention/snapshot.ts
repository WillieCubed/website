import type { Webmention } from '@/lib/indieweb/webmention/types';

interface SnapshotObject {
  text(): Promise<string>;
}

export interface SnapshotBucket {
  get(key: string): Promise<SnapshotObject | null>;
  put(key: string, value: string): Promise<unknown>;
}

type SerializedWebmention = Omit<
  Webmention,
  'publishedAt' | 'observedAt' | 'receivedAt' | 'verifiedAt'
> & {
  publishedAt?: string;
  observedAt?: string;
  receivedAt: string;
  verifiedAt?: string;
};

interface Snapshot {
  generation: string;
  expiresAt: number;
  mentions: SerializedWebmention[];
}

const KEY = 'application/public-webmentions-v1.json';
const GENERATION_KEY = 'application/public-webmentions-generation-v1.txt';
const MAX_AGE_MS = 60 * 60_000;

function serialize(mention: Webmention): SerializedWebmention {
  return {
    ...mention,
    publishedAt: mention.publishedAt?.toISOString(),
    observedAt: mention.observedAt?.toISOString(),
    receivedAt: mention.receivedAt.toISOString(),
    verifiedAt: mention.verifiedAt?.toISOString(),
  };
}

function deserialize(mention: SerializedWebmention): Webmention {
  const receivedAt = new Date(mention.receivedAt);
  if (!Number.isFinite(receivedAt.getTime()))
    throw new Error('Invalid Webmention cache date.');
  return {
    ...mention,
    publishedAt: mention.publishedAt
      ? new Date(mention.publishedAt)
      : undefined,
    observedAt: mention.observedAt ? new Date(mention.observedAt) : undefined,
    receivedAt,
    verifiedAt: mention.verifiedAt ? new Date(mention.verifiedAt) : undefined,
  };
}

/** One shared snapshot covers every public target, so varied page traffic cannot poll Neon. */
export async function readPublicWebmentionSnapshot(
  bucket: SnapshotBucket | undefined,
  load: () => Promise<Webmention[]>,
  now = Date.now()
): Promise<Webmention[]> {
  let generation = 'initial';
  let canWrite = true;
  if (bucket) {
    try {
      const marker = await bucket.get(GENERATION_KEY);
      if (marker) generation = await marker.text();
      const object = await bucket.get(KEY);
      if (object) {
        const snapshot = JSON.parse(await object.text()) as Snapshot;
        if (isCurrentSnapshot(snapshot, generation, now)) {
          return snapshot.mentions.map(deserialize);
        }
      }
    } catch (error) {
      canWrite = false;
      console.error('Reading the public Webmention snapshot failed:', error);
    }
  }

  const mentions = await load();
  if (bucket && canWrite) {
    const snapshot: Snapshot = {
      generation,
      expiresAt: now + MAX_AGE_MS,
      mentions: mentions.map(serialize),
    };
    try {
      await bucket.put(KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.error('Writing the public Webmention snapshot failed:', error);
    }
  }
  return mentions;
}

export async function invalidatePublicWebmentionSnapshot(
  bucket: SnapshotBucket | undefined
): Promise<void> {
  await bucket?.put(GENERATION_KEY, crypto.randomUUID());
}

function isCurrentSnapshot(
  snapshot: Snapshot,
  generation: string,
  now: number
): boolean {
  return (
    snapshot.generation === generation &&
    Number.isFinite(snapshot.expiresAt) &&
    snapshot.expiresAt > now &&
    Array.isArray(snapshot.mentions)
  );
}
