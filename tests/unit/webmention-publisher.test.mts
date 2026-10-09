import { VercelPool } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';

import { sendWebmention } from '@/lib/indieweb/send-webmention';
import {
  type WebmentionPublisherServices,
  sendChangedWebmentions,
} from '@/lib/indieweb/webmention-publisher';
import { absoluteUrl } from '@/lib/site';

interface Delivery {
  source_url: string;
  target_url: string;
  post_slug: string;
  content_hash: string;
  status: string;
  response_code?: number | null;
}

const target = 'https://example.com/article';
const source = absoluteUrl('/writings/hello');
const oldPostgres = process.env.POSTGRES_URL;
const oldSkip = process.env.SKIP_WEBMENTIONS;
let history: Delivery[];
let attempts: string[];
let content: string;
let published: boolean;
let answer: Awaited<ReturnType<WebmentionPublisherServices['send']>>;

const services: WebmentionPublisherServices = {
  getWritingSlugs: async () => (published ? ['hello'] : []),
  loadWriting: async () => ({
    writing: { slug: 'hello', people: [], draft: false },
    content,
  }),
  send: async (sourceUrl, targetUrl) => {
    attempts.push(`${sourceUrl} -> ${targetUrl}`);
    return { ...answer, targetUrl };
  },
};

beforeEach(() => {
  process.env.POSTGRES_URL = 'postgres://test@localhost:5432/test';
  process.env.SKIP_WEBMENTIONS = 'false';
  history = [];
  attempts = [];
  content = `Read [the article](${target}).`;
  published = true;
  answer = { targetUrl: target, success: false, statusCode: 400 };
  mock.method(
    VercelPool.prototype,
    'sql',
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join('?');
      if (query.includes('SELECT')) {
        return {
          rows: query.includes('WHERE post_slug')
            ? history.filter((row) => row.post_slug === values[0])
            : history,
          rowCount: history.length,
        };
      }
      if (query.includes('INSERT')) {
        const row: Delivery = {
          source_url: String(values[0]),
          target_url: String(values[1]),
          post_slug: String(values[2]),
          content_hash: String(values[3]),
          status: String(values[4]),
          response_code: values[6] as number | null,
        };
        const previous = history.find(
          (old) =>
            old.source_url === row.source_url &&
            old.target_url === row.target_url
        );
        if (previous) Object.assign(previous, row);
        else history.push(row);
      } else if (query.includes('UPDATE')) {
        const row = history.find(
          (old) => old.source_url === values[6] && old.target_url === values[7]
        );
        assert.ok(row);
        Object.assign(row, {
          content_hash: String(values[0]),
          status: String(values[1]),
          response_code: values[3],
        });
      } else throw new Error(`Unexpected publisher query: ${query}`);
      return { rows: [], rowCount: 1 };
    }
  );
});

afterEach(() => {
  mock.restoreAll();
  if (oldPostgres === undefined) delete process.env.POSTGRES_URL;
  else process.env.POSTGRES_URL = oldPostgres;
  if (oldSkip === undefined) delete process.env.SKIP_WEBMENTIONS;
  else process.env.SKIP_WEBMENTIONS = oldSkip;
});

test('a link without an endpoint is unsupported and unchanged content does not rediscover it', async () => {
  answer = {
    targetUrl: target,
    success: false,
    error: 'No webmention endpoint found',
  };
  assert.deepEqual(await sendChangedWebmentions(services), {
    sent: 0,
    failed: 0,
    unsupported: 1,
  });
  assert.equal(history[0].status, 'no_endpoint');
  assert.deepEqual(await sendChangedWebmentions(services), {
    sent: 0,
    failed: 0,
    unsupported: 1,
  });
  assert.equal(attempts.length, 1);
});

test('an unchanged permanent rejection retains history without failing each notification', async () => {
  assert.equal((await sendChangedWebmentions(services)).failed, 1);
  const stored = structuredClone(history);
  assert.deepEqual(await sendChangedWebmentions(services), {
    sent: 0,
    failed: 0,
    unsupported: 0,
  });
  assert.equal(attempts.length, 1);
  assert.deepEqual(history, stored);
});

test('changed content and an explicit pending reset retry a rejected destination', async () => {
  await sendChangedWebmentions(services);
  content += ' The writing changed.';
  assert.equal((await sendChangedWebmentions(services)).failed, 1);
  assert.equal(attempts.length, 2);
  history[0].status = 'pending';
  answer = { targetUrl: target, success: true, statusCode: 202 };
  assert.equal((await sendChangedWebmentions(services)).sent, 1);
  assert.equal(attempts.length, 3);
  assert.equal(history[0].status, 'sent');
});

test('server errors and transient client errors remain retryable without content changes', async () => {
  for (const code of [503, 408, 425, 429]) {
    history = [];
    attempts = [];
    answer = { targetUrl: target, success: false, statusCode: code };
    assert.equal((await sendChangedWebmentions(services)).failed, 1);
    assert.equal((await sendChangedWebmentions(services)).failed, 1);
    assert.equal(attempts.length, 2, `HTTP ${code} must remain retryable`);
  }
});

test('failed discovery stays retryable until a fetched page confirms endpoint absence', async () => {
  let status = 503;
  let requests = 0;
  const publisher: WebmentionPublisherServices = {
    ...services,
    send: (sourceUrl, targetUrl) =>
      sendWebmention(sourceUrl, targetUrl, {
        resolve: async () => [{ address: '93.184.216.34', family: 4 }],
        fetch: async (_url, init) => {
          assert.notEqual(init.method, 'POST');
          requests++;
          return new Response(
            init.method === 'HEAD' ? null : 'A public page.',
            {
              status,
            }
          );
        },
      }),
  };
  assert.equal((await sendChangedWebmentions(publisher)).failed, 1);
  assert.equal(history[0].status, 'failed');
  assert.equal(history[0].response_code, null);
  assert.equal((await sendChangedWebmentions(publisher)).failed, 1);
  assert.equal(requests, 4);
  status = 200;
  assert.deepEqual(await sendChangedWebmentions(publisher), {
    sent: 0,
    failed: 0,
    unsupported: 1,
  });
  assert.equal(history[0].status, 'no_endpoint');
  assert.equal(requests, 6);
  assert.equal((await sendChangedWebmentions(publisher)).unsupported, 1);
  assert.equal(requests, 6);
});

test('deleted writings retain delivery history and stop unchanged terminal retries', async () => {
  published = false;
  history = [
    {
      source_url: source,
      target_url: target,
      post_slug: 'hello',
      content_hash: 'the previously published content',
      status: 'sent',
      response_code: 202,
    },
  ];
  assert.equal((await sendChangedWebmentions(services)).failed, 1);
  const stored = structuredClone(history);
  assert.equal((await sendChangedWebmentions(services)).failed, 0);
  assert.equal(attempts.length, 1);
  assert.deepEqual(history, stored);
});
