import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SALMENTION_WINDOW_MS,
  type SalmentionDeps,
  htmlShowsSource,
  sendSalmention,
  upstreamTargets,
} from '@/lib/indieweb/salmention';
import type { Webmention, WebmentionSourceWriting } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

const post = `${site.origin}/writings/my-reply`;
const parent = 'https://alice.example/posts/1';
const replySource = 'https://bob.example/replies/9';

function reply(overrides: Partial<Webmention> = {}): Webmention {
  return {
    id: 'wm-1',
    sourceUrl: replySource,
    targetUrl: post,
    type: 'reply',
    author: { name: 'Bob' },
    receivedAt: new Date('2026-09-20T12:00:00Z'),
    isVerified: true,
    isApproved: true,
    ...overrides,
  };
}

const writing: WebmentionSourceWriting = {
  slug: 'my-reply',
  people: [{ name: 'Cy', url: 'https://cy.example/' }],
  inReplyTo: parent,
};

/**
 * Dependencies that record what happened: the page shows the reply from the
 * `shownFrom`th look on, and the window is open unless `claimed`.
 */
function harness({
  mention = reply() as Webmention | null,
  source = writing as WebmentionSourceWriting | null,
  shownFrom = 1,
  claimed = false,
} = {}) {
  const log = {
    looks: 0,
    sleeps: [] as number[],
    claims: [] as [string, number][],
    sent: [] as [string, string][],
  };
  const deps: SalmentionDeps = {
    findWebmention: async () => mention,
    loadWriting: async () => source,
    claim: async (slug, windowMs) => {
      log.claims.push([slug, windowMs]);
      return !claimed;
    },
    pageShows: async (pageUrl, sourceUrl) => {
      assert.equal(pageUrl, post);
      assert.equal(sourceUrl, replySource);
      log.looks++;
      return log.looks >= shownFrom;
    },
    send: async (sourceUrl, targetUrl) => {
      log.sent.push([sourceUrl, targetUrl]);
      return { targetUrl, success: true };
    },
    sleep: async (ms) => {
      log.sleeps.push(ms);
    },
  };
  return { deps, log };
}

const timing = { attempts: 3, delayMs: 1000 };

test('an approved reply resends its post to the post it answers', async () => {
  const { deps, log } = harness();
  const result = await sendSalmention('wm-1', deps, timing);
  assert.equal(result.outcome, 'sent');
  assert.deepEqual(log.sent, [[post, parent]]);
  assert.deepEqual(log.claims, [['my-reply', SALMENTION_WINDOW_MS]]);
});

test('nothing is sent until the live post shows the reply', async () => {
  const late = harness({ shownFrom: 3 });
  assert.equal(
    (await sendSalmention('wm-1', late.deps, timing)).outcome,
    'sent'
  );
  assert.deepEqual(late.log.sleeps, [1000, 1000]);

  const never = harness({ shownFrom: 99 });
  assert.equal(
    (await sendSalmention('wm-1', never.deps, timing)).outcome,
    'not-shown'
  );
  assert.equal(never.log.looks, 3);
  assert.deepEqual(never.log.sent, []);
  assert.deepEqual(
    never.log.claims,
    [],
    'the window is left for the next reply'
  );
});

test('a post that sent one within the window sends nothing', async () => {
  const { deps, log } = harness({ claimed: true });
  assert.equal(
    (await sendSalmention('wm-1', deps, timing)).outcome,
    'rate-limited'
  );
  assert.deepEqual(log.sent, []);
});

test('only a reply to a published writing that answers another site sends', async () => {
  for (const [options, outcome] of [
    [{ mention: reply({ type: 'like' }) }, 'not-a-reply'],
    [{ mention: null }, 'not-found'],
    [
      { mention: reply({ targetUrl: `${site.origin}/initiatives/twd` }) },
      'not-found',
    ],
    [{ source: null }, 'not-found'],
    [{ source: { slug: 'my-reply', people: [] } }, 'no-upstream'],
  ] as const) {
    const { deps, log } = harness(options);
    assert.equal((await sendSalmention('wm-1', deps, timing)).outcome, outcome);
    assert.deepEqual(log.sent, []);
    assert.equal(log.looks, 0);
  }
});

test('upstream leaves out this site and the reply’s own source', () => {
  assert.deepEqual(
    upstreamTargets(
      {
        slug: 'x',
        people: [{ name: 'Cy', url: 'https://cy.example/' }],
        inReplyTo: parent,
        likeOf: `${site.origin}/writings/mine`,
        repostOf: `https://www.${new URL(site.origin).host}/writings/also-mine`,
        bookmarkOf: replySource,
        rsvp: { eventUrl: 'https://events.example/e/1', status: 'yes' },
      },
      replySource
    ),
    [parent, 'https://events.example/e/1']
  );
});

test('a reply from the post this one answered is not sent back to it', async () => {
  const { deps, log } = harness({
    mention: reply({ sourceUrl: parent }),
  });
  deps.pageShows = async () => true;
  assert.equal(
    (await sendSalmention('wm-1', deps, timing)).outcome,
    'no-upstream'
  );
  assert.deepEqual(log.sent, []);
});

test('the page check finds the reply’s address as React escapes it', () => {
  const source = 'https://bob.example/r?id=1&lang=en';
  assert.ok(
    htmlShowsSource(
      `<data class="u-url" value="https://bob.example/r?id=1&amp;lang=en">`,
      source
    )
  );
  assert.ok(!htmlShowsSource('<p>Nothing yet</p>', source));
});
