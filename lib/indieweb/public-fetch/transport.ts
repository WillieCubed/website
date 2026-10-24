import type { LookupFunction } from 'node:net';
import { Agent, buildConnector, fetch as undiciFetch } from 'undici';

import {
  type AddressResolver,
  blockedAddressError,
  isCloudflareRuntime,
  isPublicAddress,
  resolvePublicAddresses,
  systemResolver,
} from './address';

const CONNECT_TIMEOUT_MS = 5000;

function wantedFamily(family: number | string | undefined): 0 | 4 | 6 {
  if (family === 4 || family === 'IPv4') return 4;
  if (family === 6 || family === 'IPv6') return 6;
  return 0;
}

/**
 * A `lookup` for sockets that resolves with `resolve` and refuses a name if
 * any of its addresses is not public. This runs for the connection itself, so
 * the address checked is the address connected to.
 */
export function createPublicOnlyLookup(
  resolve: AddressResolver = systemResolver
): LookupFunction {
  return (hostname, options, callback) => {
    resolvePublicAddresses(hostname, resolve).then(
      (resolved) => {
        const wanted = wantedFamily(options.family);
        const addresses =
          wanted !== 0
            ? resolved.filter(({ family }) => family === wanted)
            : resolved;
        if (addresses.length === 0) {
          callback(blockedAddressError(hostname), '');
        } else if (options.all) {
          callback(null, addresses);
        } else {
          callback(null, addresses[0].address, addresses[0].family);
        }
      },
      (error: NodeJS.ErrnoException) => callback(error, '')
    );
  };
}

/**
 * A dispatcher whose sockets only connect to public addresses: names go
 * through the public-only lookup, and the connected peer is checked again,
 * which also covers IP literals that never reach a lookup.
 */
export function createPublicOnlyAgent(
  resolve: AddressResolver = systemResolver
): Agent {
  const connector = buildConnector({
    lookup: createPublicOnlyLookup(resolve),
    timeout: CONNECT_TIMEOUT_MS,
  });
  return new Agent({
    connect(options, callback) {
      connector(options, (error, socket) => {
        if (error) {
          callback(error, null);
          return;
        }
        const peer = socket?.remoteAddress;
        if (socket == null || !peer || !isPublicAddress(peer)) {
          socket?.destroy();
          callback(blockedAddressError(options.hostname), null);
          return;
        }
        callback(null, socket);
      });
    },
  });
}

/** How documents are requested. Tests pass their own. */
export interface DocumentFetchRequest {
  headers: Record<string, string>;
  method?: string;
  body?: URLSearchParams;
  redirect: 'manual';
  signal: AbortSignal;
}

export type DocumentFetch = (
  url: string,
  init: DocumentFetchRequest
) => Promise<Response>;

let sharedAgent: Agent | undefined;

export function publicOnlyFetch(resolve: AddressResolver): DocumentFetch {
  return async (url, init) => {
    if (isCloudflareRuntime()) {
      // Workers' fetch is routed through Cloudflare's public network. Undici's
      // socket options are unavailable there; URL and redirect guards remain.
      return fetch(url, init);
    }
    const dispatcher =
      resolve === systemResolver
        ? (sharedAgent ??= createPublicOnlyAgent())
        : createPublicOnlyAgent(resolve);
    return (await undiciFetch(url, {
      ...init,
      dispatcher,
    })) as unknown as Response;
  };
}
