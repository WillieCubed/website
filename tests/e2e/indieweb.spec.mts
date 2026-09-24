import { expect, test } from '@playwright/test';
import { mf2 } from 'microformats-parser';
import type { MicroformatRoot } from 'microformats-parser/dist/types';

import { site } from '../../lib/site';

function rootOfType(items: MicroformatRoot[], type: string) {
  return items.find((item) => item.type.includes(type));
}

test('the homepage exposes a parseable representative h-card and endpoints', async ({
  request,
}) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  const card = rootOfType(mf2(html, { baseUrl: site.origin }).items, 'h-card');
  expect(card?.properties.name).toContain(site.author.name);
  expect(card?.properties.url).toContain(`${site.origin}/`);
  expect(card?.properties.photo?.length).toBeGreaterThan(0);
  expect(html).toMatch(/<link[^>]+rel="webmention"[^>]+href="\/webmention"/);
  expect(html).toMatch(/<link[^>]+rel="micropub"[^>]+href="\/micropub"/);
  expect(html).toMatch(/<link[^>]+rel="indieauth-metadata"/);
});

test('the initiatives page exposes a parseable feed and author', async ({
  request,
}) => {
  const response = await request.get('/initiatives');
  expect(response.status()).toBe(200);
  const feed = rootOfType(
    mf2(await response.text(), { baseUrl: `${site.origin}/initiatives` }).items,
    'h-feed'
  );
  expect(feed?.properties.name).toContain('Initiatives');
  expect(feed?.properties.url).toContain(`${site.origin}/initiatives`);
  const author = feed?.properties.author?.[0] as MicroformatRoot | undefined;
  expect(author?.type).toContain('h-card');
  expect(author?.properties.name).toContain(site.author.name);
  // An empty feed is valid while every initiative is a draft.
  for (const entry of feed?.children ?? []) {
    expect(entry.type).toContain('h-entry');
    expect(entry.properties.url?.length).toBeGreaterThan(0);
  }
});

test('the writings page exposes a parseable feed and author', async ({
  request,
}) => {
  const response = await request.get('/writings');
  expect(response.status()).toBe(200);
  const feed = rootOfType(
    mf2(await response.text(), { baseUrl: `${site.origin}/writings` }).items,
    'h-feed'
  );
  expect(feed?.properties.name).toContain('Writings');
  expect(feed?.properties.url).toContain(`${site.origin}/writings`);
  const author = feed?.properties.author?.[0] as MicroformatRoot | undefined;
  expect(author?.type).toContain('h-card');
  expect(author?.properties.name).toContain(site.author.name);
  for (const entry of feed?.children ?? []) {
    expect(entry.type).toContain('h-entry');
    expect(entry.properties.url?.length).toBeGreaterThan(0);
  }
});

test('feed documents advertise their own URL and the WebSub hub', async ({
  request,
}) => {
  for (const [path, type] of [
    ['/feed.xml', 'application/rss+xml'],
    ['/feed/atom', 'application/atom+xml'],
    ['/feed/json', 'application/feed+json'],
    ['/writings/feed.xml', 'application/rss+xml'],
    ['/writings/feed/atom', 'application/atom+xml'],
    ['/writings/feed/json', 'application/feed+json'],
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain(type);
    const body = await response.text();
    expect(body, path).toContain(`${site.origin}${path}`);
    expect(body, path).toContain('https://pubsubhubbub.appspot.com/');
    if (type === 'application/feed+json') {
      expect(response.headers().link, path).toContain(
        '<https://pubsubhubbub.appspot.com/>; rel="hub"'
      );
      expect(response.headers().link, path).toContain(
        `<${site.origin}${path}>; rel="self"`
      );
    }
  }
});

test('WebFinger and IndieAuth metadata resolve the advertised endpoints', async ({
  request,
}) => {
  const webfinger = await request.get(
    `/.well-known/webfinger?resource=acct:${site.author.handle}@${new URL(site.origin).host}`
  );
  expect(webfinger.status()).toBe(200);
  const identity = await webfinger.json();
  expect(identity.aliases).toContain(site.origin);
  expect(identity.links).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rel: 'micropub',
        href: `${site.origin}/micropub`,
      }),
      expect.objectContaining({ href: `${site.origin}/webmention` }),
    ])
  );
  const metadata = await request.get('/.well-known/oauth-authorization-server');
  expect(metadata.status()).toBe(200);
  const oauth = await metadata.json();
  expect(oauth.authorization_endpoint).toBe(`${site.origin}/indieauth/auth`);
  expect(oauth.token_endpoint).toBe(`${site.origin}/indieauth/token`);
});

test('Micropub advertises capabilities and rejects unauthenticated creation', async ({
  request,
}) => {
  const config = await request.get('/micropub?q=config');
  expect(config.status()).toBe(200);
  const capabilities = await config.json();
  expect(capabilities['post-types']).toEqual(
    expect.arrayContaining([expect.objectContaining({ type: 'note' })])
  );
  expect(capabilities['syndicate-to']).toBeUndefined();
  expect(
    (await (await request.get('/micropub?q=syndicate-to')).json())[
      'syndicate-to'
    ]
  ).toEqual([]);
  const create = await request.post('/micropub', {
    form: { h: 'entry', content: 'This must not be published.' },
  });
  expect(create.status()).toBe(401);
  const invalid = await request.post('/micropub', {
    headers: { authorization: 'Bearer invalid-test-token' },
    form: { h: 'entry', content: 'This must not be published.' },
  });
  const tokenStoreAvailable = Boolean(
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.INDIEWEB_TEST_BASE_URL
  );
  expect(invalid.status()).toBe(tokenStoreAvailable ? 401 : 503);
  expect((await invalid.json()).error).toBe(
    tokenStoreAvailable ? 'invalid_token' : 'temporarily_unavailable'
  );
});

test('the Webmention receiver rejects invalid input before storage', async ({
  request,
}) => {
  const missing = await request.post('/webmention', {
    form: { source: 'https://example.com/' },
  });
  expect(missing.status()).toBe(400);
  const insecure = await request.post('/webmention', {
    form: { source: 'http://example.com/', target: `${site.origin}/` },
  });
  expect(insecure.status()).toBe(400);
});

const postPath = process.env.INDIEWEB_TEST_POST_PATH;
test('a published writing has a parseable author, permalink, date, and content', async ({
  request,
}) => {
  test.skip(
    !postPath,
    'Set INDIEWEB_TEST_POST_PATH to a published test writing.'
  );
  const response = await request.get(postPath!);
  expect(response.status()).toBe(200);
  const entry = rootOfType(
    mf2(await response.text(), { baseUrl: `${site.origin}${postPath}` }).items,
    'h-entry'
  );
  expect(entry?.properties.url).toContain(`${site.origin}${postPath}`);
  expect(entry?.properties.published?.length).toBeGreaterThan(0);
  expect(entry?.properties.content?.length).toBeGreaterThan(0);
  const author = entry?.properties.author?.[0] as MicroformatRoot | undefined;
  expect(author?.type).toContain('h-card');
  expect(author?.properties.name).toContain(site.author.name);
  const feed = await request.get('/writings/feed/json');
  expect(feed.status()).toBe(200);
  const feedItem = (await feed.json()).items.find(
    (item: { url: string }) => item.url === `${site.origin}${postPath}`
  );
  expect(feedItem?.date_published).toBeTruthy();
  expect(feedItem?.content_html).toBeTruthy();
});
