import assert from 'node:assert/strict';
import test from 'node:test';

import type { DocumentFetch } from '@/lib/indieweb/public-fetch';
import {
  type VouchStore,
  applyVouch,
  linksToDomain,
  readVouchParameter,
  vouchDomain,
} from '@/lib/indieweb/vouch';
import { site } from '@/lib/site';

const PUBLIC = [{ address: '93.184.216.34', family: 4 }];
const source = 'https://stranger.example/replies/1';
const vouchUrl = 'https://friend.example/blogroll';

/** A store where friend.example once accepted a webmention from this site. */
function memoryStore({
  approvedDomains = [] as string[],
  accepted = ['https://friend.example/posts/1'],
  pending = true,
} = {}) {
  const approvals: { id: string; vouchUrl: string }[] = [];
  const store: VouchStore = {
    async hasApprovedSource(domain) {
      return approvedDomains.includes(domain);
    },
    async acceptedTargets() {
      return accepted;
    },
    async approveByVouch(id, vouch) {
      if (!pending) return false;
      approvals.push({ id, vouchUrl: vouch });
      return true;
    },
  };
  return { store, approvals };
}

/** Pages served by address, recording every request. */
function pages(table: Record<string, Response | (() => Response)>) {
  const requested: string[] = [];
  const fetch: DocumentFetch = async (url) => {
    requested.push(url);
    const page = table[url];
    if (!page) return new Response('Not found', { status: 404 });
    return typeof page === 'function' ? page() : page;
  };
  return { fetch, requested, resolve: async () => PUBLIC };
}

const vouching = () =>
  new Response(
    '<p>I read <a href="https://www.stranger.example/">Stranger</a>.</p>',
    {
      headers: { 'Content-Type': 'text/html' },
    }
  );

test('a vouch from a trusted domain that links to the sender approves the mention', async () => {
  const { store, approvals } = memoryStore();
  const network = pages({ [vouchUrl]: vouching });
  const outcome = await applyVouch(
    { id: 'wm-1', sourceUrl: source, vouchUrl },
    store,
    network
  );
  assert.equal(outcome, 'approved');
  assert.deepEqual(approvals, [{ id: 'wm-1', vouchUrl }]);
  assert.deepEqual(network.requested, [vouchUrl]);
});

test('a sender with an approved mention already is left to moderation, unfetched', async () => {
  const { store, approvals } = memoryStore({
    approvedDomains: ['stranger.example'],
  });
  const network = pages({ [vouchUrl]: vouching });
  assert.equal(
    await applyVouch(
      { id: 'wm-1', sourceUrl: source, vouchUrl },
      store,
      network
    ),
    'known-sender'
  );
  assert.deepEqual(approvals, []);
  assert.deepEqual(network.requested, []);
});

test('a vouch on a domain that never accepted a webmention from here is not trusted', async () => {
  const { store, approvals } = memoryStore();
  const network = pages({});
  for (const untrusted of [
    'https://github.com/stranger/links',
    'https://friend.example.evil.example/',
  ]) {
    assert.equal(
      await applyVouch(
        { id: 'wm-1', sourceUrl: source, vouchUrl: untrusted },
        store,
        network
      ),
      'untrusted',
      untrusted
    );
  }
  assert.deepEqual(approvals, []);
  assert.deepEqual(network.requested, []);
});

test('a page on this site can vouch', async () => {
  const { store, approvals } = memoryStore({ accepted: [] });
  const own = `${site.origin}/writings/friends`;
  const network = pages({ [own]: vouching });
  assert.equal(
    await applyVouch(
      { id: 'wm-1', sourceUrl: source, vouchUrl: own },
      store,
      network
    ),
    'approved'
  );
  assert.equal(approvals.length, 1);
});

test('a vouch page that does not link to the sender’s domain approves nothing', async () => {
  const { store, approvals } = memoryStore();
  const network = pages({
    [vouchUrl]: new Response(
      '<p>Text that says stranger.example</p>' +
        '<!-- <a href="https://stranger.example/">hidden</a> -->' +
        '<a href="https://stranger.example.other.example/">lookalike</a>' +
        '<link rel="me" href="https://stranger.example/">'
    ),
  });
  assert.equal(
    await applyVouch(
      { id: 'wm-1', sourceUrl: source, vouchUrl },
      store,
      network
    ),
    'no-link'
  );
  assert.deepEqual(approvals, []);
});

test('a vouch that redirects off the trusted domain is not trusted', async () => {
  const { store, approvals } = memoryStore();
  const network = pages({
    [vouchUrl]: new Response(null, {
      status: 302,
      headers: { Location: 'https://spam.example/vouch' },
    }),
    'https://spam.example/vouch': vouching,
  });
  assert.equal(
    await applyVouch(
      { id: 'wm-1', sourceUrl: source, vouchUrl },
      store,
      network
    ),
    'untrusted'
  );
  assert.deepEqual(approvals, []);
});

test('a vouch that cannot be read, or sits on a private address, approves nothing', async () => {
  const { store, approvals } = memoryStore();
  const missing = pages({});
  assert.equal(
    await applyVouch(
      { id: 'wm-1', sourceUrl: source, vouchUrl },
      store,
      missing
    ),
    'unreadable'
  );
  const internal = {
    ...pages({ [vouchUrl]: vouching }),
    resolve: async () => [{ address: '10.0.0.5', family: 4 }],
  };
  assert.equal(
    await applyVouch(
      { id: 'wm-1', sourceUrl: source, vouchUrl },
      store,
      internal
    ),
    'unreadable'
  );
  assert.deepEqual(internal.requested, []);
  assert.deepEqual(approvals, []);
});

test('a mention that is no longer pending is not approved twice', async () => {
  const { store } = memoryStore({ pending: false });
  const network = pages({ [vouchUrl]: vouching });
  assert.equal(
    await applyVouch(
      { id: 'wm-1', sourceUrl: source, vouchUrl },
      store,
      network
    ),
    'not-pending'
  );
});

test('the vouch parameter is optional but must be a web URL when sent', () => {
  assert.deepEqual(readVouchParameter(null), { vouch: null });
  assert.deepEqual(readVouchParameter(''), { vouch: null });
  assert.deepEqual(readVouchParameter(vouchUrl), { vouch: vouchUrl });
  for (const bad of ['not a url', 'javascript:alert(1)', ['x'], 42]) {
    assert.ok('error' in readVouchParameter(bad), String(bad));
  }
});

test('domains compare without case, port, or a leading www', () => {
  assert.equal(vouchDomain('https://WWW.Example.com:8443/x'), 'example.com');
  assert.equal(vouchDomain('not a url'), null);
  assert.ok(
    linksToDomain(
      '<a href="//Example.com/about">x</a>',
      'https://friend.example/',
      'example.com'
    )
  );
  assert.ok(
    !linksToDomain(
      '<a href="/about">relative</a>',
      'https://friend.example/',
      'example.com'
    )
  );
});
