import { now } from '@atcute/tid';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { OWNER } from './config.mts';
import { save } from './journal.mts';
import { pause } from './shared.mts';
import type { Journal, OwnedAccount, XrpcReply } from './types.mts';
import { deployWorker, handleSource } from './workers.mts';

export async function request(
  origin: string,
  endpoint: string,
  body?: unknown,
  authorization?: string
) {
  const noInput = [
    'com.atproto.server.requestEmailConfirmation',
    'com.atproto.server.deleteSession',
  ].includes(endpoint);
  const response = await fetch(`${origin}/xrpc/${endpoint}`, {
    method: body === undefined && !noInput ? 'GET' : 'POST',
    redirect: 'error',
    headers: {
      ...(body === undefined || noInput
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: body === undefined || noInput ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      `PDS ${endpoint.split('?')[0]} failed (${response.status}, ${result.error ?? 'unavailable'}).`
    );
  }
  return (await response.json().catch(() => ({}))) as XrpcReply;
}
export async function session(journal: Journal, account: OwnedAccount) {
  const result = await request(
    journal.origin,
    'com.atproto.server.createSession',
    { identifier: account.handle, password: account.password }
  );
  assert(
    result.did &&
      result.did !== OWNER &&
      (!account.did || result.did === account.did)
  );
  return result as {
    did: string;
    accessJwt: string;
    refreshJwt: string;
    emailConfirmed?: boolean;
  };
}
export async function provisionAccount(
  journal: Journal,
  journalPath: string,
  account: OwnedAccount
) {
  if (!account.did) {
    try {
      const recovered = await session(journal, account);
      account.did = recovered.did;
    } catch {
      if (!account.invite) {
        const invite = await request(
          journal.origin,
          'com.atproto.server.createInviteCode',
          { useCount: 1 },
          `Basic ${Buffer.from(`admin:${journal.adminPassword}`).toString('base64')}`
        );
        account.invite = invite.code;
        await save(journalPath, journal);
      }
      const created = await request(
        journal.origin,
        'com.atproto.server.createAccount',
        {
          email: account.email,
          handle: account.handle,
          password: account.password,
          inviteCode: account.invite,
        }
      );
      assert(created.did && created.did !== OWNER);
      account.did = created.did;
    }
    await save(journalPath, journal);
  }
  await deployWorker(
    journal,
    journalPath,
    account.handle.split('.')[0],
    handleSource(journal, account)
  );
  const auth = await session(journal, account);
  await verifyIdentity(journal, account);
  // Account creation can reach the relay before its new DID can be served by the handle Worker.
  await request(
    journal.origin,
    'com.atproto.identity.updateHandle',
    { handle: account.handle },
    `Bearer ${auth.accessJwt}`
  );
  await confirmOwnedEmail();
  assert(
    (
      await request(
        journal.origin,
        'com.atproto.server.getSession',
        undefined,
        `Bearer ${auth.accessJwt}`
      )
    ).emailConfirmed === true
  );
  account.confirmed = true;
  if (!account.appPassword) {
    const result = await request(
      journal.origin,
      'com.atproto.server.createAppPassword',
      { name: 'willie.page acceptance', privileged: false },
      `Bearer ${auth.accessJwt}`
    );
    account.appPassword = result.password;
    await save(journalPath, journal);
  }
  const checked = await request(
    journal.origin,
    'com.atproto.server.createSession',
    { identifier: account.did, password: account.appPassword }
  );
  assert(checked.did === account.did);
  await request(
    journal.origin,
    'com.atproto.server.deleteSession',
    {},
    `Bearer ${checked.refreshJwt}`
  );
  await save(journalPath, journal);
  return auth;
  async function confirmOwnedEmail(): Promise<void> {
    if (auth.emailConfirmed) return;
    await request(
      journal.origin,
      'com.atproto.server.requestEmailConfirmation',
      {},
      `Bearer ${auth.accessJwt}`
    );
    let token: string | undefined;
    for (let attempt = 0; attempt < 15 && !token; attempt++) {
      for (const name of (
        await readdir(resolve(journal.data, 'mail'))
      ).reverse()) {
        const message = await readFile(
          resolve(journal.data, 'mail', name),
          'utf8'
        );
        if (!message.includes(account.email)) continue;
        const decoded = message
          .replace(/=\r\n/g, '')
          .replace(/=([A-F0-9]{2})/g, (_, hex: string) =>
            String.fromCharCode(parseInt(hex, 16))
          );
        token = decoded.match(
          /([a-z2-7]{5}-[a-z2-7]{5}) is your verification code/i
        )?.[1];
        if (token) break;
      }
      if (!token) await pause(1000);
    }
    assert(token, 'The provider confirmation email was not received.');
    await request(
      journal.origin,
      'com.atproto.server.confirmEmail',
      { email: account.email, token },
      `Bearer ${auth.accessJwt}`
    );
  }
}
export async function verifyIdentity(journal: Journal, account: OwnedAccount) {
  assert(account.did?.startsWith('did:plc:') && account.did !== OWNER);
  const handle = await fetch(
    `https://${account.handle}/.well-known/atproto-did`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) }
  );
  assert(handle.ok && (await handle.text()).trim() === account.did);
  const resolved = await fetch(`https://plc.directory/${account.did}`, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  assert(resolved.ok);
  const identity = await resolved.json();
  assert(
    identity.id === account.did &&
      identity.alsoKnownAs.includes(`at://${account.handle}`)
  );
  assert(
    identity.service.some(
      (service: Record<string, unknown>) =>
        service.type === 'AtprotoPersonalDataServer' &&
        service.serviceEndpoint === journal.origin
    )
  );
}
export async function readRecord(
  journal: Journal,
  account: OwnedAccount,
  collection: string,
  rkey: string
) {
  const response = await fetch(
    `${journal.origin}/xrpc/com.atproto.repo.getRecord?repo=${account.did}&collection=${collection}&rkey=${rkey}`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) }
  );
  if (response.status === 400) {
    const error = await response.json();
    assert(error.error === 'RecordNotFound');
    return undefined;
  }
  assert(response.ok, 'The PDS record read failed.');
  return response.json();
}
export async function federation(journal: Journal, journalPath: string) {
  if (journal.federation) {
    for (const account of [journal.publisher, journal.visitor]) {
      await verifyIdentity(journal, account);
      const profile = await request(
        'https://public.api.bsky.app',
        `app.bsky.actor.getProfile?actor=${account.did}`
      );
      assert(profile.did === account.did && profile.handle === account.handle);
    }
    await removeProbes(journal, journalPath);
    return;
  }
  await awaitRelaySubscription();
  for (const [role, account] of [
    ['publisher', journal.publisher],
    ['visitor', journal.visitor],
  ] as const)
    await publishFederationProbe(role, account);
  await awaitAppViewObservation();
  await removeProbes(journal, journalPath);
  async function awaitRelaySubscription(): Promise<void> {
    await request('https://bsky.network', 'com.atproto.sync.requestCrawl', {
      hostname: new URL(journal.origin).hostname,
    });
    // A newly discovered relay host starts at its current stream offset.
    // Subscribe before writing the records that must reach AppView.
    let relayActive = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const host = (await request(
          'https://bsky.network',
          `com.atproto.sync.getHostStatus?hostname=${new URL(journal.origin).hostname}`
        )) as unknown as { status?: string };
        if (host.status === 'active') {
          relayActive = true;
          break;
        }
      } catch {
        // The relay may not expose the newly requested host yet.
      }
      await pause(1000);
    }
    assert(relayActive, 'The relay has not subscribed to the owned PDS.');
  }
  async function publishFederationProbe(
    role: string,
    account: OwnedAccount
  ): Promise<void> {
    await verifyIdentity(journal, account);
    const auth = await session(journal, account);
    if (!account.profile) {
      assert(
        !(await readRecord(journal, account, 'app.bsky.actor.profile', 'self'))
      );
      account.profile = {
        value: {
          $type: 'app.bsky.actor.profile',
          displayName: `Website acceptance ${role}`,
          description: 'Temporary isolated protocol verification account.',
        },
      };
      await save(journalPath, journal);
    }
    if (!account.profile.cid) {
      const existing = await readRecord(
        journal,
        account,
        'app.bsky.actor.profile',
        'self'
      );
      if (existing)
        assert(isDeepStrictEqual(existing.value, account.profile.value));
      const record =
        existing ??
        (await request(
          journal.origin,
          'com.atproto.repo.putRecord',
          {
            repo: account.did,
            collection: 'app.bsky.actor.profile',
            rkey: 'self',
            record: account.profile.value,
            swapRecord: null,
          },
          `Bearer ${auth.accessJwt}`
        ));
      account.profile.cid = record.cid;
      await save(journalPath, journal);
    }
    if (!account.probe) {
      const rkey = now();
      assert(!(await readRecord(journal, account, 'app.bsky.feed.post', rkey)));
      account.probe = {
        rkey,
        value: {
          $type: 'app.bsky.feed.post',
          text: `Temporary website federation check ${journal.run} ${role}.`,
          createdAt: new Date().toISOString(),
        },
      };
      await save(journalPath, journal);
    }
    if (!account.probe.cid && !account.probe.removed) {
      const existing = await readRecord(
        journal,
        account,
        'app.bsky.feed.post',
        account.probe.rkey
      );
      if (existing)
        assert(isDeepStrictEqual(existing.value, account.probe.value));
      const record =
        existing ??
        (await request(
          journal.origin,
          'com.atproto.repo.putRecord',
          {
            repo: account.did,
            collection: 'app.bsky.feed.post',
            rkey: account.probe.rkey,
            record: account.probe.value,
            swapRecord: null,
          },
          `Bearer ${auth.accessJwt}`
        ));
      account.probe.cid = record.cid;
      await save(journalPath, journal);
    }
  }
  async function awaitAppViewObservation(): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        for (const account of [journal.publisher, journal.visitor]) {
          const profile = await request(
            'https://public.api.bsky.app',
            `app.bsky.actor.getProfile?actor=${account.did}`
          );
          assert(
            profile.did === account.did && profile.handle === account.handle
          );
          if (!account.probe!.removed) {
            const uri = `at://${account.did}/app.bsky.feed.post/${account.probe!.rkey}`;
            const posts = await request(
              'https://public.api.bsky.app',
              `app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`
            );
            assert(
              posts.posts.some(
                (post) =>
                  post.uri === uri &&
                  post.cid === account.probe!.cid &&
                  post.author.did === account.did
              )
            );
          }
        }
        journal.federation = new Date().toISOString();
        await save(journalPath, journal);
        break;
      } catch {
        if (attempt === 59)
          throw new Error(
            'The public AppView has not independently observed both owned accounts and posts.'
          );
        await pause(5000);
      }
    }
  }
}
async function removeProbes(journal: Journal, journalPath: string) {
  for (const account of [journal.publisher, journal.visitor]) {
    if (!account.probe!.removed) {
      const current = await readRecord(
        journal,
        account,
        'app.bsky.feed.post',
        account.probe!.rkey
      );
      if (current) {
        assert(current.cid === account.probe!.cid);
        const auth = await session(journal, account);
        await request(
          journal.origin,
          'com.atproto.repo.deleteRecord',
          {
            repo: account.did,
            collection: 'app.bsky.feed.post',
            rkey: account.probe!.rkey,
            swapRecord: current.cid,
          },
          `Bearer ${auth.accessJwt}`
        );
      }
      assert(
        !(await readRecord(
          journal,
          account,
          'app.bsky.feed.post',
          account.probe!.rkey
        ))
      );
      account.probe!.removed = true;
      await save(journalPath, journal);
    }
  }
}
