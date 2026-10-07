import { safeParse } from '@atcute/lexicons';
import {
  SiteStandardGraphRecommend,
  SiteStandardGraphSubscription,
} from '@atcute/standard-site';

export type GraphCollection =
  | 'site.standard.graph.subscription'
  | 'site.standard.graph.recommend';
export type SocialAction = 'subscription' | 'recommendation';
export interface GraphRecord {
  uri: string;
  value: Record<string, unknown>;
}
export interface GraphRepo {
  list(collection: GraphCollection): Promise<GraphRecord[]>;
  create(
    collection: GraphCollection,
    value: Record<string, unknown>
  ): Promise<void>;
  remove(collection: GraphCollection, rkey: string): Promise<void>;
}

function graph(action: SocialAction) {
  return action === 'subscription'
    ? ({
        collection: 'site.standard.graph.subscription',
        field: 'publication',
      } as const)
    : ({
        collection: 'site.standard.graph.recommend',
        field: 'document',
      } as const);
}

async function matches(repo: GraphRepo, action: SocialAction, target: string) {
  const { collection, field } = graph(action);
  return (await repo.list(collection)).filter(
    (record) => record.value[field] === target
  );
}

export async function graphState(
  repo: GraphRepo,
  action: SocialAction,
  target: string
): Promise<boolean> {
  return (await matches(repo, action, target)).length > 0;
}

/** The caller holds a distributed lock for this visitor and target. */
export async function setGraphState(
  repo: GraphRepo,
  action: SocialAction,
  target: string,
  active: boolean
): Promise<boolean> {
  const { collection, field } = graph(action);
  const existing = await matches(repo, action, target);
  if (active && existing.length === 0) {
    const value = {
      $type: collection,
      [field]: target,
      createdAt: new Date().toISOString(),
    };
    const checked = safeParse(
      action === 'subscription'
        ? SiteStandardGraphSubscription.mainSchema
        : SiteStandardGraphRecommend.mainSchema,
      value
    );
    if (!checked.ok) throw new Error(checked.message);
    await repo.create(collection, value);
  } else if (!active) {
    for (const record of existing)
      await repo.remove(
        collection,
        record.uri.slice(record.uri.lastIndexOf('/') + 1)
      );
  }
  return active;
}
