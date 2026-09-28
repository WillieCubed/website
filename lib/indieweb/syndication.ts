import type { MicropubSyndicationTarget } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

/**
 * The accounts in `site.syndication` as Micropub syndication targets. The
 * site has no API access to either service, so choosing one records the
 * intent in the post (`syndicateTo`) and the copy is still posted by hand.
 */
export function getMicropubSyndicationTargets(): MicropubSyndicationTarget[] {
  return site.syndication.map((account) => ({
    uid: account.profile,
    name: `${account.handle} on ${account.service}`,
    service: { name: account.service, url: account.serviceUrl },
    user: { name: account.handle, url: account.profile },
  }));
}

/**
 * The targets a client chose with `mp-syndicate-to`. A client only offers
 * the uids `q=syndicate-to` listed, so an unknown one is a bad request rather
 * than something to drop quietly.
 */
export function resolveSyndicationTargets(
  uids: string[]
): MicropubSyndicationTarget[] {
  const targets = getMicropubSyndicationTargets();
  const chosen = [...new Set(uids.filter(Boolean))].map((uid) =>
    targets.find((target) => target.uid === uid)
  );
  if (chosen.some((target) => !target)) throw new Error('invalid_request');
  return chosen.filter((target) => target !== undefined);
}

/**
 * The label a syndication link shows under a post: the service's name for a
 * copy on one of the accounts above, the host for anything else.
 */
export function syndicationName(url: string): string {
  const host = new URL(url).hostname;
  const account = site.syndication.find(
    (candidate) => new URL(candidate.serviceUrl).hostname === host
  );
  return account?.service ?? host;
}
