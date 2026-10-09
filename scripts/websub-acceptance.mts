#!/usr/bin/env node
import { createPool } from '@vercel/postgres';
import { type ChildProcess, spawn } from 'node:child_process';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { type IncomingMessage, createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { type DefaultTreeAdapterTypes, parse } from 'parse5';

import { pingWebSubHub } from '../lib/indieweb/websub-publisher';

const { values } = parseArgs({
  options: {
    topic: {
      type: 'string',
      default: 'https://indieweb-acceptance.vercel.app/writings/feed.xml',
    },
    expect: { type: 'string' },
    output: { type: 'string', default: '.playwright-mcp/websub-receipt.json' },
    'wait-seconds': { type: 'string', default: '1200' },
    publish: { type: 'boolean', default: false },
    hosted: { type: 'boolean', default: false },
  },
});
const topicUrl = new URL(values.topic);
if (
  topicUrl.origin !== 'https://indieweb-acceptance.vercel.app' ||
  topicUrl.username ||
  topicUrl.password ||
  topicUrl.hash ||
  topicUrl.search
)
  throw new Error('This check accepts only the isolated acceptance site.');
if (!values.expect)
  throw new Error(
    'Pass --expect with a marker that the next isolated publication will add.'
  );
const marker = values.expect;
const waitSeconds = Number(values['wait-seconds']);
if (
  !Number.isSafeInteger(waitSeconds) ||
  waitSeconds < 10 ||
  waitSeconds > 3600
)
  throw new Error('--wait-seconds must be between 10 and 3600.');
const output = resolve(values.output);
const abort = new AbortController();
const abortRun = () => abort.abort(new Error('Receipt check interrupted.'));
process.once('SIGINT', abortRun);
process.once('SIGTERM', abortRun);
const sha256 = (body: string | Buffer) =>
  createHash('sha256').update(body).digest('hex');
const timestamp = () => new Date().toISOString();
const log = (event: string, details: object = {}) =>
  console.log(JSON.stringify({ event, at: timestamp(), ...details }));
const record: Record<string, unknown> = {
  startedAt: timestamp(),
  topic: topicUrl.href,
  expectedMarker: marker,
  publisherPingIsNotDelivery: true,
  result: 'pending',
};
async function persist() {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(record, null, 2) + '\n', {
    mode: 0o600,
  });
}
async function fetchTopic() {
  const response = await fetch(topicUrl, {
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Topic returned HTTP ${response.status}.`);
  if (response.url !== topicUrl.href)
    throw new Error('Acceptance topic redirected.');
  return { response, body: await response.text() };
}
function linkRelations(header: string | null, base: string) {
  const result: Array<{ href: string; relations: string[] }> = [];
  for (const match of (header ?? '').matchAll(/<([^>]+)>\s*((?:;[^,]*)*)/g)) {
    const relation = /;\s*rel\s*=\s*(?:"([^"]+)"|([^;\s,]+))/i.exec(match[2]);
    if (relation)
      result.push({
        href: new URL(match[1], base).href,
        relations: (relation[1] ?? relation[2]).split(/\s+/),
      });
  }
  return result;
}
function embeddedRelations(body: string, base: string) {
  const result: Array<{ href: string; relations: string[] }> = [];
  function visit(node: DefaultTreeAdapterTypes.Node) {
    if (node.nodeName === 'link' || node.nodeName === 'atom:link') {
      const attrs = 'attrs' in node ? node.attrs : undefined;
      const href = attrs?.find((attr) => attr.name === 'href')?.value;
      const rel = attrs?.find((attr) => attr.name === 'rel')?.value;
      if (href && rel)
        result.push({
          href: new URL(href, base).href,
          relations: rel.split(/\s+/),
        });
    }
    if ('childNodes' in node) for (const child of node.childNodes) visit(child);
  }
  visit(parse(body));
  return result;
}
async function readDelivery(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    length += bytes.length;
    if (length > 8 * 1024 * 1024) throw new Error('Delivery exceeds 8 MiB.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}
const secret = randomBytes(32).toString('hex');
const callbackPath = `/websub/${randomBytes(24).toString('hex')}`;
const hostedId = randomBytes(24).toString('hex');
let database: ReturnType<typeof createPool> | undefined;
let pendingMode: 'subscribe' | 'unsubscribe' | null = null;
let active = false;
let subscribed = false;
let tunnel: ChildProcess | undefined;
let callback: string | undefined;
let hub: string | undefined;
let contentType = '';
let baselineHash = '';
let receipt: Record<string, unknown> | undefined;
const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname !== callbackPath) {
    response.writeHead(404).end();
    return;
  }
  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    const lease = url.searchParams.get('hub.lease_seconds');
    if (
      mode === 'denied' &&
      url.searchParams.get('hub.topic') === topicUrl.href
    ) {
      record.denied = {
        at: timestamp(),
        reason: url.searchParams.get('hub.reason'),
      };
      abort.abort(new Error('Hub denied the subscription.'));
      response
        .writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end();
      return;
    }
    if (
      mode !== pendingMode ||
      url.searchParams.get('hub.topic') !== topicUrl.href ||
      !challenge ||
      !/^[+\-\d./=A-Z_a-z]+$/.test(challenge) ||
      (mode === 'subscribe' &&
        (!lease || !/^\d+$/.test(lease) || Number(lease) <= 0))
    ) {
      response.writeHead(404).end();
      return;
    }
    pendingMode = null;
    active = mode === 'subscribe';
    record[
      mode === 'subscribe'
        ? 'subscriptionVerification'
        : 'unsubscribeVerification'
    ] = {
      at: timestamp(),
      challengeSha256: sha256(challenge),
      leaseSeconds: mode === 'subscribe' ? Number(lease) : undefined,
    };
    log(`${mode}-verified`, { topic: topicUrl.href });
    response
      .writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end(challenge);
    return;
  }
  if (request.method !== 'POST' || !active) {
    response.writeHead(404).end();
    return;
  }
  try {
    const payload = await readDelivery(request);
    const signatures = String(request.headers['x-hub-signature'] ?? '').split(
      ','
    );
    let algorithm: string | undefined;
    for (const signature of signatures) {
      const parsed = /^(sha1|sha256|sha384|sha512)=([a-f\d]+)$/i.exec(
        signature.trim()
      );
      if (!parsed) continue;
      const digest = createHmac(parsed[1].toLowerCase(), secret)
        .update(payload)
        .digest();
      const received = Buffer.from(parsed[2], 'hex');
      if (
        received.length === digest.length &&
        timingSafeEqual(received, digest)
      ) {
        algorithm = parsed[1].toLowerCase();
        break;
      }
    }
    if (!algorithm) {
      log('delivery-rejected', { reason: 'missing-or-invalid-signature' });
      response.writeHead(403).end();
      return;
    }
    const deliveredType = String(request.headers['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const deliveredLinks = linkRelations(
      String(request.headers.link ?? ''),
      topicUrl.href
    );
    if (
      deliveredType !== contentType ||
      deliveredLinks.some(
        (link) => link.relations.includes('self') && link.href !== topicUrl.href
      )
    ) {
      log('delivery-rejected', { reason: 'content-type-or-topic-mismatch' });
      response.writeHead(400).end();
      return;
    }
    const hash = sha256(payload);
    const containsMarker = payload.toString('utf8').includes(marker);
    log('signed-delivery', {
      bytes: payload.length,
      sha256: hash,
      containsMarker,
      changed: hash !== baselineHash,
    });
    if (containsMarker && hash !== baselineHash)
      receipt = {
        at: timestamp(),
        bytes: payload.length,
        sha256: hash,
        signatureAlgorithm: algorithm,
        contentType: deliveredType,
        body: payload.toString('utf8'),
      };
    response.writeHead(204).end();
  } catch (error) {
    log('delivery-rejected', {
      reason: error instanceof Error ? error.message : String(error),
    });
    response.writeHead(413).end();
  }
});
async function waitFor(
  predicate: () => boolean,
  seconds: number,
  signal = abort.signal
) {
  const deadline = Date.now() + seconds * 1000;
  while (!predicate()) {
    if (values.hosted) await refreshHosted();
    if (predicate()) break;
    if (Date.now() > deadline)
      throw new Error(`Timed out after ${seconds} seconds.`);
    await delay(250, undefined, { signal });
  }
}
async function requestSubscription(mode: 'subscribe' | 'unsubscribe') {
  pendingMode = mode;
  if (database)
    await database.query(
      'UPDATE acceptance_websub_receipts SET pending_mode=$2 WHERE id=$1',
      [hostedId, mode]
    );
  const response = await fetch(hub!, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      'hub.mode': mode,
      'hub.topic': topicUrl.href,
      'hub.callback': callback!,
      'hub.lease_seconds': '3600',
      ...(mode === 'subscribe' ? { 'hub.secret': secret } : {}),
    }),
  });
  record[
    mode === 'subscribe'
      ? 'subscriptionRequestStatus'
      : 'unsubscribeRequestStatus'
  ] = response.status;
  if (response.status !== 202)
    throw new Error(
      `Hub ${mode} returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`
    );
  log(`${mode}-accepted`, { status: response.status });
}
async function refreshHosted() {
  const row = (
    await database!.query(
      'SELECT active,pending_mode,subscription_verification,unsubscribe_verification,delivery FROM acceptance_websub_receipts WHERE id=$1',
      [hostedId]
    )
  ).rows[0];
  if (!row) throw new Error('Hosted subscriber state disappeared.');
  active = row.active;
  pendingMode = row.pending_mode;
  if (row.subscription_verification)
    record.subscriptionVerification = row.subscription_verification;
  if (row.unsubscribe_verification)
    record.unsubscribeVerification = row.unsubscribe_verification;
  if (row.delivery) receipt = row.delivery;
}
async function prepareHosted() {
  const settings = JSON.parse(await readFile('.env.visual.local', 'utf8'));
  const connectionString = settings.POSTGRES_URL;
  if (
    typeof connectionString !== 'string' ||
    new URL(connectionString).hostname !==
      'ep-winter-wind-b5iiaxe7-pooler.c-7.us-east-2.aws.neon.tech'
  )
    throw new Error(
      'Hosted callback requires the verified isolated acceptance Neon database.'
    );
  database = createPool({ connectionString, max: 1 });
  await database.query(`CREATE TABLE IF NOT EXISTS acceptance_websub_receipts (
    id text PRIMARY KEY, topic text NOT NULL, secret text NOT NULL,
    marker text NOT NULL, baseline_hash text NOT NULL, content_type text NOT NULL,
    pending_mode text, active boolean NOT NULL DEFAULT false,
    subscription_verification jsonb, unsubscribe_verification jsonb, delivery jsonb,
    expires_at timestamptz NOT NULL
  )`);
  await database.query(
    `INSERT INTO acceptance_websub_receipts
    (id,topic,secret,marker,baseline_hash,content_type,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW()+INTERVAL '1 hour')`,
    [hostedId, topicUrl.href, secret, marker, baselineHash, contentType]
  );
  callback = `${topicUrl.origin}/api/acceptance-websub/${hostedId}`;
  record.callbackOrigin = topicUrl.origin;
  record.callbackKind = 'temporary-hosted-acceptance-route';
}
try {
  log('discovering', { topic: topicUrl.href });
  const initial = await fetchTopic();
  if (initial.body.includes(marker))
    throw new Error(
      'The marker already exists. Choose a new marker to prove a changed publication.'
    );
  contentType = (initial.response.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  baselineHash = sha256(initial.body);
  const headerLinks = linkRelations(
    initial.response.headers.get('link'),
    topicUrl.href
  );
  const relations = headerLinks.length
    ? headerLinks
    : embeddedRelations(initial.body, topicUrl.href);
  const selves = relations.filter((link) => link.relations.includes('self'));
  hub = relations.find((link) => link.relations.includes('hub'))?.href;
  if (
    selves.length !== 1 ||
    selves[0].href !== topicUrl.href ||
    !hub ||
    new URL(hub).protocol !== 'https:'
  )
    throw new Error(
      'Topic must advertise one matching self URL and an HTTPS hub.'
    );
  Object.assign(record, {
    hub,
    discovery: headerLinks.length ? 'http-link' : 'embedded-link',
    baselineSha256: baselineHash,
    contentType,
  });
  if (values.hosted) {
    await prepareHosted();
  } else {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Subscriber did not bind a TCP port.');
    tunnel = spawn(
      'cloudflared',
      [
        'tunnel',
        '--config',
        '/dev/null',
        '--no-autoupdate',
        '--protocol',
        'http2',
        '--url',
        `http://127.0.0.1:${address.port}`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const tunnelOrigin = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              'HTTPS callback tunnel did not become available within 45 seconds.'
            )
          ),
        45000
      );
      let logs = '';
      const read = (chunk: Buffer) => {
        logs = (logs + chunk.toString()).slice(-10000);
        const match = /https:\/\/[a-z\d-]+\.trycloudflare\.com/.exec(logs);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      };
      tunnel!.stdout?.on('data', read);
      tunnel!.stderr?.on('data', read);
      tunnel!.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      tunnel!.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`HTTPS callback tunnel exited (${code}).`));
      });
    });
    callback = tunnelOrigin + callbackPath;
    record.callbackOrigin = tunnelOrigin;
    log('callback-created', { callbackOrigin: tunnelOrigin });
    const readyDeadline = Date.now() + 45000;
    for (;;) {
      try {
        const ready = await fetch(callback, {
          signal: AbortSignal.timeout(5000),
        });
        if (ready.status === 404) break;
      } catch {
        /* The edge can publish the tunnel URL before its route connects. */
      }
      if (Date.now() > readyDeadline)
        throw new Error('HTTPS callback route did not become reachable.');
      await delay(1000, undefined, { signal: abort.signal });
    }
  }
  log('subscriber-ready', {
    callbackOrigin: record.callbackOrigin,
    topic: topicUrl.href,
  });
  await requestSubscription('subscribe');
  subscribed = true;
  await waitFor(() => active, 90);
  await persist();
  log('waiting-for-publication', { marker, seconds: waitSeconds });
  const deadline = Date.now() + waitSeconds * 1000;
  let published = false;
  while (!receipt) {
    if (values.hosted) await refreshHosted();
    if (Date.now() > deadline)
      throw new Error('No signed delivery of the changed publication arrived.');
    if (values.publish && !published) {
      const current = await fetchTopic();
      if (
        current.body.includes(marker) &&
        sha256(current.body) !== baselineHash
      ) {
        record.publisherPing = await pingWebSubHub([topicUrl.href], hub);
        published = true;
        log('publisher-ping', record.publisherPing as object);
      }
    }
    await delay(1000, undefined, { signal: abort.signal });
  }
  const current = await fetchTopic();
  if (!current.body.includes(marker))
    throw new Error('Delivery marker does not appear in the public topic.');
  Object.assign(record, {
    result: 'passed',
    delivery: receipt,
    publicTopicSha256: sha256(current.body),
    completedAt: timestamp(),
  });
  log('delivery-confirmed', { output });
} catch (error) {
  record.result = 'failed';
  record.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
  log('check-failed', { reason: record.error });
} finally {
  if (subscribed && callback && hub) {
    try {
      await requestSubscription('unsubscribe');
      await waitFor(
        () => !active && pendingMode === null,
        45,
        new AbortController().signal
      );
      record.cleanup = 'unsubscription-verified';
    } catch (error) {
      record.cleanup = 'unsubscription-unconfirmed';
      record.cleanupError =
        error instanceof Error ? error.message : String(error);
      process.exitCode = 1;
    }
  }
  await persist();
  if (database) {
    await database.query('DELETE FROM acceptance_websub_receipts WHERE id=$1', [
      hostedId,
    ]);
    const remaining = (
      await database.query(
        'SELECT COUNT(*) AS count FROM acceptance_websub_receipts'
      )
    ).rows[0].count;
    if (Number(remaining) === 0)
      await database.query('DROP TABLE acceptance_websub_receipts');
    await database.end();
  }
  tunnel?.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
  process.removeListener('SIGINT', abortRun);
  process.removeListener('SIGTERM', abortRun);
}
