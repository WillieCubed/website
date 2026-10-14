import assert from 'node:assert/strict';

import { ACCOUNT } from './config.mts';
import { save } from './journal.mts';
import { command } from './process.mts';
import type { Journal, OwnedAccount } from './types.mts';

async function cfToken() {
  const token = JSON.parse(
    command('wrangler', ['auth', 'token', '--json'])
  ) as { token?: string };
  assert(token.token, 'Cloudflare credentials are unavailable.');
  return token.token;
}
export async function cloudflare(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await cfToken()}`);
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/${path}`,
    {
      ...init,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    }
  );
}
export async function deployWorker(
  journal: Journal,
  journalPath: string,
  name: string,
  source: string
) {
  const previous = journal.workers.find((worker) => worker.name === name);
  const existing = await cloudflare(`workers/scripts/${name}/content/v2`);
  if (existing.ok) {
    const existingBody = await workerContent(existing);
    assert(
      previous && !previous.removed && previous.versions.includes(existingBody),
      'Refuse an unowned or changed Worker.'
    );
  } else assert(existing.status === 404, 'Cannot establish Worker ownership.');
  const worker = previous ?? { name, source, versions: [] };
  // Persist the intended resource before upload so an uncertain network outcome remains recoverable.
  if (!previous) journal.workers.push(worker);
  if (!worker.versions.includes(source)) worker.versions.push(source);
  await save(journalPath, journal);
  const form = new FormData();
  form.set(
    'metadata',
    JSON.stringify({
      main_module: 'index.mjs',
      compatibility_date: '2026-10-08',
      compatibility_flags: ['global_fetch_strictly_public'],
    })
  );
  form.set(
    'index.mjs',
    new Blob([source], { type: 'application/javascript+module' }),
    'index.mjs'
  );
  const uploaded = await cloudflare(`workers/scripts/${name}`, {
    method: 'PUT',
    body: form,
  });
  assert(uploaded.ok, `The owned Worker upload failed (${uploaded.status}).`);
  const enabled = await cloudflare(`workers/scripts/${name}/subdomain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true, previews_enabled: false }),
  });
  assert(enabled.ok, `The owned Worker hostname failed (${enabled.status}).`);
  const observed = await cloudflare(`workers/scripts/${name}/content/v2`);
  assert(
    observed.ok && (await workerContent(observed)) === source,
    'Worker upload was not observed.'
  );
  worker.source = source;
  await save(journalPath, journal);
}
export async function workerContent(response: Response) {
  const form = await response.formData();
  const entries = [...form.entries()];
  assert(
    entries.length === 1 && entries[0][0] === 'index.mjs',
    'The Worker module inventory changed.'
  );
  const value = entries[0][1];
  return typeof value === 'string' ? value : value.text();
}
export function proxySource(journal: Journal) {
  assert(journal.tunnel);
  return `// owned:${journal.marker}\nconst host=${JSON.stringify(new URL(journal.origin).hostname)};\nconst upstream=${JSON.stringify(journal.tunnel.upstream)};\nexport default {async fetch(request){const url=new URL(request.url);if(url.hostname!==host)return new Response('Not found',{status:404});const target=new URL(upstream);target.pathname=url.pathname;target.search=url.search;return fetch(new Request(target,request),{redirect:'manual'});}};\n`;
}
export function handleSource(journal: Journal, account: OwnedAccount) {
  return `// owned:${journal.marker}\nconst host=${JSON.stringify(account.handle)};const did=${JSON.stringify(account.did ?? '')};export default {fetch(request){const url=new URL(request.url);return url.hostname===host&&url.pathname==='/.well-known/atproto-did'&&did?new Response(did,{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}}):new Response('Not found',{status:404});}};\n`;
}
