import { now } from '@atcute/tid';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { ACCOUNT, DEFAULT_JOURNAL, DOMAIN, IMAGE, ROOT } from './config.mts';
import { ensureContainer, ensureTunnel } from './infrastructure.mts';
import { privateWrite, save, validate } from './journal.mts';
import { federation, provisionAccount, verifyIdentity } from './pds.mts';
import { command, freePort } from './process.mts';
import type {
  AcceptanceIdentities,
  Journal,
  ProvisionedAccount,
} from './types.mts';
import { deployWorker, handleSource, proxySource } from './workers.mts';

export async function loadOwnedAcceptanceIdentities(
  journalPath = DEFAULT_JOURNAL,
  expectedPublisherDid?: string
): Promise<AcceptanceIdentities> {
  journalPath = resolve(journalPath);
  const journal = JSON.parse(await readFile(journalPath, 'utf8')) as Journal;
  validate(journal, journalPath);
  assert(journal.federation && !journal.cleaned);
  assert(
    journal.publisher.did &&
      journal.publisher.appPassword &&
      journal.visitor.did &&
      journal.visitor.appPassword
  );
  assert(journal.publisher.did !== journal.visitor.did);
  if (expectedPublisherDid)
    assert(journal.publisher.did === expectedPublisherDid);
  await verifyIdentity(journal, journal.publisher);
  await verifyIdentity(journal, journal.visitor);
  return {
    origin: journal.origin,
    journalPath,
    publisher: journal.publisher as ProvisionedAccount,
    visitor: journal.visitor as ProvisionedAccount,
  };
}
export async function provisionAcceptanceIdentities(
  options: { envPath?: string; journalPath?: string } = {}
): Promise<AcceptanceIdentities> {
  const journalPath = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  const journal = await loadProvisioningJournal();
  console.log(
    'Step 1: Start the owned official PDS with a 1 CPU and 1 GiB limit.'
  );
  await ensureContainer(journal, journalPath);
  console.log(
    'Step 2: Publish the owned PDS proxy and handle endpoints on the personal Workers account.'
  );
  await ensureTunnel(journal, journalPath);
  await deployWorker(
    journal,
    journalPath,
    new URL(journal.origin).hostname.split('.')[0],
    proxySource(journal)
  );
  for (const account of [journal.publisher, journal.visitor])
    await deployWorker(
      journal,
      journalPath,
      account.handle.split('.')[0],
      handleSource(journal, account)
    );
  console.log(
    'Step 3: Create two invited accounts and confirm their email through normal provider APIs.'
  );
  for (const account of [journal.publisher, journal.visitor])
    await provisionAccount(journal, journalPath, account);
  const metadata = await fetch(
    `${journal.origin}/.well-known/oauth-authorization-server`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) }
  );
  assert(metadata.ok && (await metadata.json()).issuer === journal.origin);
  console.log(
    'Step 4: Wait for public PLC, relay ingestion, and independent Bluesky AppView reads.'
  );
  await federation(journal, journalPath);
  await configurePublishingCredential();
  await privateWrite(
    resolve(dirname(journalPath), 'evidence.json'),
    JSON.stringify(
      {
        timestamp: journal.federation,
        origin: journal.origin,
        image: journal.image,
        serverVersion: journal.serverVersion,
        advertisedVersion: journal.advertisedVersion,
        accounts: [journal.publisher, journal.visitor].map((account) => ({
          handle: account.handle,
          did: account.did,
          emailConfirmed: account.confirmed,
          publicAppViewPostCid: account.probe?.cid,
          probeRemoved: account.probe?.removed,
        })),
        network: {
          plc: 'https://plc.directory',
          relay: 'https://bsky.network',
          appView: 'https://public.api.bsky.app',
        },
      },
      null,
      2
    ) + '\n'
  );
  return loadOwnedAcceptanceIdentities(journalPath);
  async function loadProvisioningJournal(): Promise<Journal> {
    let journal: Journal;
    try {
      journal = JSON.parse(await readFile(journalPath, 'utf8'));
      validate(journal, journalPath);
      assert(!journal.cleaned);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try {
        await stat(resolve(dirname(journalPath), 'pds'));
        throw new Error(
          'Refuse a preexisting PDS directory without an ownership journal.',
          { cause: error }
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const run = randomBytes(5).toString('hex');
      const key = createECDH('secp256k1');
      key.generateKeys();
      journal = {
        version: 1,
        account: ACCOUNT,
        domain: DOMAIN,
        run,
        marker: randomBytes(32).toString('hex'),
        origin: `https://willie-pds-${run}.${DOMAIN}`,
        container: `dev-williecubed-website-pds-${run}`,
        port: await freePort(),
        image: IMAGE,
        data: resolve(dirname(journalPath), 'pds'),
        adminPassword: randomBytes(32).toString('hex'),
        jwtSecret: randomBytes(32).toString('hex'),
        rotationKey: key.getPrivateKey('hex'),
        workers: [],
        publisher: {
          handle: `pub${run}.${DOMAIN}`,
          email: `publisher-${run}@williecubed.dev`,
          password: randomBytes(32).toString('base64url'),
        },
        visitor: {
          handle: `vis${run}.${DOMAIN}`,
          email: `visitor-${run}@williecubed.dev`,
          password: randomBytes(32).toString('base64url'),
        },
        started: new Date().toISOString(),
      };
      await save(journalPath, journal);
      await mkdir(journal.data, { mode: 0o700 });
      await privateWrite(
        resolve(journal.data, '.acceptance-owner'),
        journal.marker
      );
    }

    return journal;
  }
  async function configurePublishingCredential(): Promise<void> {
    const envPath = resolve(
      options.envPath ?? resolve(ROOT, '.env.standard-test.local')
    );
    let text = '';
    try {
      text = await readFile(envPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const previous = parseEnv(text);
    const settings = {
      NEXT_PUBLIC_ATPROTO_DID: journal.publisher.did!,
      NEXT_PUBLIC_BLUESKY_HANDLE: journal.publisher.handle,
      ATPROTO_APP_PASSWORD: journal.publisher.appPassword!,
      ATPROTO_PUBLICATION_RKEY:
        previous.NEXT_PUBLIC_ATPROTO_DID === journal.publisher.did &&
        previous.ATPROTO_PUBLICATION_RKEY
          ? previous.ATPROTO_PUBLICATION_RKEY
          : now(),
      NEXT_PUBLIC_SITE_ORIGIN: 'https://indieweb-acceptance.vercel.app',
      ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL: journalPath,
      ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN: journal.origin,
    };
    await privateWrite(
      envPath,
      [
        ...text
          .split('\n')
          .filter(
            (line) =>
              line.length > 0 &&
              !Object.keys(settings).some((name) => line.startsWith(`${name}=`))
          ),
        ...Object.entries(settings).map(
          ([name, value]) => `${name}=${JSON.stringify(value)}`
        ),
      ].join('\n') + '\n'
    );
    console.log(
      'Step 5: Configure only the isolated acceptance Vercel project.'
    );
    for (const [name, value] of Object.entries(settings).filter(
      ([name]) => !name.startsWith('ATPROTO_ACCEPTANCE_')
    ))
      command(
        'vercel',
        [
          'env',
          'add',
          name,
          'production',
          '--project',
          'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm',
          '--scope',
          'williecubed-projects',
          '--force',
          '--yes',
          ...(name === 'ATPROTO_APP_PASSWORD' ? ['--sensitive'] : []),
        ],
        value + '\n'
      );
    journal.configured = true;
    await save(journalPath, journal);
  }
}
