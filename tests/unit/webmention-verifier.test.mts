import { VercelPool } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';

import {
  type VerifyWebmentionOptions,
  verifyWebmention,
} from '@/lib/indieweb/webmention-verifier';
import { site } from '@/lib/site';

// `sql` builds its pool lazily from POSTGRES_URL, so a localhost address is
// enough to reach the stubbed query below without a database.
process.env.POSTGRES_URL = 'postgres://test@localhost:5432/test';

const source = 'https://example.com/replies/1';
const target = `${site.origin}/writings/hello`;

interface Query {
  text: string;
  values: unknown[];
}

let queries: Query[] = [];
let fetched: string[] = [];
let respond: (url: string) => Response = () =>
  new Response('', { status: 500 });

/**
 * How the verifier reaches the network in these tests: every name resolves
 * to one public address, and each request gets `respond`'s answer.
 */
const network: VerifyWebmentionOptions = {
  resolve: async () => [{ address: '93.184.216.34', family: 4 }],
  fetch: async (url) => {
    fetched.push(url);
    return respond(url);
  },
};

function verify(
  id: string,
  sourceUrl: string,
  targetUrl: string,
  options: VerifyWebmentionOptions = {}
) {
  return verifyWebmention(id, sourceUrl, targetUrl, { ...network, ...options });
}

/** Serve `body` with `status` for the source, and record every fetch. */
function serveSource(body: string, status = 200) {
  respond = () =>
    new Response(body, {
      status,
      headers: { 'Content-Type': 'text/html' },
    });
}

beforeEach(() => {
  queries = [];
  fetched = [];
  mock.method(
    VercelPool.prototype,
    'sql',
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ text: strings.join('?'), values });
      return { rows: [], rowCount: 1 };
    }
  );
});

afterEach(() => mock.restoreAll());

const softDeletes = () =>
  queries.filter((query) => /is_deleted = TRUE/.test(query.text));
const verifications = () =>
  queries.filter((query) => /is_verified = TRUE/.test(query.text));

test('a property-only linked file survives verification as a contained attachment', async () => {
  const file = 'https://media.example/report.pdf';
  serveSource(
    `<article class="h-entry"><a class="u-in-reply-to" href="${target}">Original</a><p class="p-content">A report.</p><a class="u-attachment" href="${file}">Report</a></article>`
  );
  const result = await verify('wm-file', source, target);
  assert.equal(result.success, true);
  assert.equal(result.content, 'A report.');
  assert.equal(
    result.contentHtml,
    `<p>A report.</p><figure><a href="${file}" rel="nofollow ugc" class="u-attachment">Attachment</a></figure>`
  );
  assert.ok(verifications()[0].values.includes(result.contentHtml));
});

test('relative inline attachments keep their labels without duplicating absolute properties', async () => {
  const file = 'https://media.example/reports/report.pdf?format=pdf&download=1';
  const missing = 'https://media.example/reports/appendix.pdf';
  serveSource(
    `<head><base href="https://media.example/reports/"></head><article class="h-entry"><a class="u-in-reply-to" href="${target}">Original</a><div class="e-content"><p><a class="u-attachment" href="report.pdf?format=pdf&amp;download=1">A named PDF report</a></p><p>The appendix URL is ${missing}.</p></div><a class="u-attachment" href="${file.replaceAll('&', '&amp;')}">The same report</a><a class="u-attachment" href="${missing}">Appendix</a></article>`
  );
  const result = await verify('wm-inline-file', source, target);
  assert.equal(result.success, true);
  assert.equal(
    result.contentHtml,
    `<p><a href="${file.replaceAll('&', '&amp;')}" rel="nofollow ugc" class="u-attachment">A named PDF report</a></p><p>The appendix URL is ${missing}.</p><figure><a href="${missing}" rel="nofollow ugc" class="u-attachment">Attachment</a></figure>`
  );
  assert.ok(verifications()[0].values.includes(result.contentHtml));
});

test('a reply marked up as an h-entry is verified with its author and content', async () => {
  serveSource(`
    <article class="h-entry">
      <div class="p-author h-card">
        <img class="u-photo" src="/me.jpg" alt="">
        <a class="p-name u-url" href="https://example.com/">Ada Lovelace</a>
      </div>
      <a class="u-in-reply-to" href="${target}">In reply to</a>
      <div class="e-content">Great <b>post</b>!<script>alert(1)</script></div>
      <time class="dt-published" datetime="2026-09-01T12:00:00Z"></time>
    </article>
  `);

  const result = await verify('wm-1', source, target);

  assert.equal(result.success, true);
  assert.equal(result.type, 'reply');
  assert.deepEqual(result.author, {
    name: 'Ada Lovelace',
    url: 'https://example.com/',
    photo: 'https://example.com/me.jpg',
  });
  assert.equal(result.content, 'Great post!');
  assert.equal(result.contentHtml, 'Great <strong>post</strong>!');
  assert.deepEqual(result.publishedAt, new Date('2026-09-01T12:00:00Z'));
  assert.deepEqual(fetched, [source]);

  const [update] = verifications();
  assert.ok(update, 'the row is marked verified');
  assert.equal(update.values[0], 'reply');
  assert.ok(update.values.includes('Great post!'), 'the text is stored');
  assert.ok(
    update.values.includes('Great <strong>post</strong>!'),
    'the sanitized markup is stored'
  );
  assert.equal(update.values.at(-1), 'wm-1');
});

test('a reply given as p-content is stored as text without markup', async () => {
  serveSource(`
    <article class="h-entry">
      <a class="u-in-reply-to" href="${target}">In reply to</a>
      <p class="p-content">1 &lt; 2 &amp; 3</p>
    </article>
  `);
  const result = await verify('wm-1', source, target);
  assert.equal(result.content, '1 < 2 & 3');
  assert.equal(result.contentHtml, undefined);
});

test('a reply that names its author by address stores the author page’s h-card', async () => {
  serveSource(`
    <article class="h-entry">
      <a class="u-author" href="https://ada.example/"></a>
      <a class="u-in-reply-to" href="${target}">In reply to</a>
      <p class="e-content">Hi.</p>
    </article>
  `);
  const requested: string[] = [];
  const result = await verify('wm-1', source, target, {
    fetchAuthorPage: async (url) => {
      requested.push(url);
      return {
        url,
        html: '<div class="h-card"><a class="u-url u-uid p-name" href="https://ada.example/">Ada</a></div>',
      };
    },
  });
  assert.deepEqual(requested, ['https://ada.example/']);
  assert.deepEqual(result.author, {
    name: 'Ada',
    url: 'https://ada.example/',
  });
  const [update] = verifications();
  assert.ok(update.values.includes('Ada'), 'the name is stored');
});

test('likes and reposts are told apart from replies', async () => {
  serveSource(
    `<div class="h-entry"><a class="u-like-of" href="${target}">Liked</a></div>`
  );
  assert.equal((await verify('wm-1', source, target)).type, 'like');

  serveSource(
    `<div class="h-entry"><a class="u-repost-of" href="${target}">Reposted</a></div>`
  );
  assert.equal((await verify('wm-1', source, target)).type, 'repost');
});

test('replies, likes, reposts, and bookmarks marked up as citations keep their kind', async () => {
  const kinds = [
    ['u-in-reply-to', 'reply'],
    ['u-like-of', 'like'],
    ['u-repost-of', 'repost'],
    ['u-bookmark-of', 'bookmark'],
  ] as const;
  for (const [property, type] of kinds) {
    serveSource(`
      <div class="h-entry">
        <div class="${property} h-cite">
          <a class="u-url p-name" href="${target}">Hello</a>
          by <span class="p-author h-card">Willie</span>
        </div>
      </div>
    `);
    const result = await verify('wm-1', source, target);
    assert.equal(result.type, type, property);
  }
});

test('a reply that gives an RSVP answer is stored as an RSVP with the answer', async () => {
  serveSource(`
    <div class="h-entry">
      <a class="u-in-reply-to" href="${target}">The event</a>
      <data class="p-rsvp" value="Yes">I'll be there</data>
    </div>
  `);
  const result = await verify('wm-1', source, target);
  assert.equal(result.type, 'rsvp');
  assert.equal(result.rsvp, 'yes');
  const [update] = verifications();
  assert.deepEqual(update.values.slice(0, 2), ['rsvp', 'yes']);
});

test('an RSVP answer the spec does not define leaves the reply a reply', async () => {
  serveSource(`
    <div class="h-entry">
      <a class="u-in-reply-to" href="${target}">The event</a>
      <span class="p-rsvp">perhaps</span>
    </div>
  `);
  const result = await verify('wm-1', source, target);
  assert.equal(result.type, 'reply');
  assert.equal(result.rsvp, undefined);
  const [update] = verifications();
  assert.deepEqual(update.values.slice(0, 2), ['reply', null]);
});

test('a citation whose address is an image with alt text is still a reply', async () => {
  serveSource(`
    <div class="h-entry">
      <div class="u-in-reply-to h-cite">
        <img class="u-url" src="${target}" alt="Hello">
      </div>
    </div>
  `);
  assert.equal((await verify('wm-1', source, target)).type, 'reply');
});

test('a citation of another page leaves a link to the target a mention', async () => {
  serveSource(`
    <div class="h-entry">
      <div class="u-in-reply-to h-cite">
        <a class="u-url" href="https://example.org/posts/other">Other</a>
      </div>
      <div class="e-content">See also <a href="${target}">this</a>.</div>
    </div>
  `);
  assert.equal((await verify('wm-1', source, target)).type, 'mention');
});

test('a reply to the same path on another site is not a reply to this one', async () => {
  serveSource(`
    <div class="h-entry">
      <a class="u-in-reply-to" href="https://other.example/writings/hello">Re</a>
      <div class="e-content">Unlike <a href="${target}">this one</a>.</div>
    </div>
  `);
  assert.equal((await verify('wm-1', source, target)).type, 'mention');
});

test('a page that links without an h-entry is a plain mention', async () => {
  serveSource(`<p>Read <a href="${target}">this</a>.</p>`);
  const result = await verify('wm-1', source, target);
  assert.deepEqual(result, { success: true, type: 'mention' });
  assert.equal(verifications().length, 1);
});

test('a source that no longer links to the target deletes the mention', async () => {
  serveSource(
    `<p>Read <a href="${site.origin}/writings/hello-world">this</a>.</p>`
  );
  const result = await verify('wm-1', source, target);
  assert.equal(result.isDeleted, true);
  assert.equal(result.error, 'Source no longer links to target');
  assert.deepEqual(softDeletes()[0].values, ['wm-1']);
});

test('a source that is gone or missing deletes the mention', async () => {
  for (const status of [410, 404]) {
    queries = [];
    serveSource('', status);
    const result = await verify('wm-1', source, target);
    assert.equal(result.success, true);
    assert.equal(result.isDeleted, true);
    assert.match(result.error ?? '', new RegExp(String(status)));
    assert.equal(softDeletes().length, 1);
  }
});

test('a source that errors fails without touching the stored mention', async () => {
  serveSource('Server error', 500);
  const result = await verify('wm-1', source, target);
  assert.deepEqual(result, {
    success: false,
    error: 'Failed to fetch source: 500',
  });
  assert.equal(queries.length, 0);
});

test('a source that cannot be reached fails with the network error', async () => {
  respond = () => {
    throw new Error('getaddrinfo ENOTFOUND example.com');
  };
  const result = await verify('wm-1', source, target);
  assert.deepEqual(result, {
    success: false,
    error: 'getaddrinfo ENOTFOUND example.com',
  });
  assert.equal(queries.length, 0);
});

test('a source on a private address is refused without a request', async () => {
  serveSource(`<a href="${target}">internal</a>`);
  for (const address of ['10.0.0.5', '169.254.169.254', '127.0.0.1']) {
    const result = await verify('wm-1', 'https://intranet.example/', target, {
      resolve: async () => [{ address, family: 4 }],
    });
    assert.equal(result.success, false, address);
  }
  assert.deepEqual(fetched, []);
  assert.equal(queries.length, 0);
});

test('a source that redirects to a private address is not followed', async () => {
  respond = (url) =>
    url === source
      ? new Response(null, {
          status: 302,
          headers: { Location: 'http://169.254.169.254/latest/meta-data/' },
        })
      : new Response(`<a href="${target}">metadata</a>`);
  const result = await verify('wm-1', source, target);
  assert.equal(result.success, false);
  assert.deepEqual(fetched, [source]);
  assert.equal(queries.length, 0);
});

test('identical source and target or foreign targets are refused unfetched', async () => {
  serveSource(`<a href="${target}">self</a>`);

  const self = await verify('wm-1', target, target);
  assert.deepEqual(self, {
    success: false,
    error: 'Source and target must be different pages.',
  });

  const offsite = await verify('wm-1', source, 'https://example.org/post');
  assert.deepEqual(offsite, {
    success: false,
    error: 'Target is not on this site',
  });

  const invalid = await verify('wm-1', 'not a url', target);
  assert.equal(invalid.success, false);

  assert.deepEqual(fetched, []);
  assert.equal(queries.length, 0);
});

test('a distinct HTTP source on this site can mention another page', async () => {
  serveSource(
    `<article class="h-entry"><a class="u-in-reply-to" href="${target}">Parent</a><p class="p-content">Local reply</p></article>`
  );
  const result = await verify(
    'local',
    `${site.origin.replace('https:', 'http:')}/writings/other`,
    target
  );
  assert.equal(result.type, 'reply');
});

test('verification selects the citing entry and resolves its base URL', async () => {
  serveSource(
    `<base href="${site.origin}/writings/"><article class="h-entry"><p class="p-content">Unrelated entry</p></article><article class="h-entry"><a class="u-in-reply-to" href="hello">Parent</a><p class="p-content">Selected reply</p></article>`
  );
  const result = await verify('second', source, target);
  assert.equal(result.content, 'Selected reply');
  assert.equal(result.type, 'reply');
});

test('a target printed as text does not verify a link', async () => {
  serveSource(`<p>${target}</p>`);
  assert.equal((await verify('text', source, target)).isDeleted, true);
});

test('verification retains the submitted target query while storage stays canonical', async () => {
  serveSource(`<a href="${target}">Canonical only</a>`);
  assert.equal(
    (
      await verify('query', source, target, {
        verificationTarget: target + '?context=1',
      })
    ).isDeleted,
    true
  );
});
