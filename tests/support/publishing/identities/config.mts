import { resolve } from 'node:path';

import { repositoryRoot } from '../runtime.mts';

export const ACCOUNT = '18f90fa11cf0a87145be4a1517e41217';
export const DOMAIN = 'willieechalmers-18f.workers.dev';
export const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
export const IMAGE =
  'ghcr.io/bluesky-social/pds@sha256:3a8feb3415e319dbcc13372293b7ef1fb05a318a6ff1d55968cf99ba6633c5d4';
export const ROOT = repositoryRoot;
export const DEFAULT_JOURNAL = resolve(
  ROOT,
  '.playwright-mcp/acceptance-identities/ownership.json'
);
