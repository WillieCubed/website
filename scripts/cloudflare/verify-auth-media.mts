#!/usr/bin/env node
/** Exercise hosted IndieAuth, Hyperdrive token writes, and R2 media delivery. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { type DefaultTreeAdapterMap, parse } from 'parse5';

import {
  decodeBase32,
  totpCode,
  totpStep,
} from '../../lib/indieweb/indieauth-owner';

const [origin, totpFile, bucket] = process.argv.slice(2);
if (!origin || !totpFile || !bucket || new URL(origin).origin !== origin) {
  throw new Error(
    'Usage: verify-auth-media.mts <preview-origin> <private-totp-file> <preview-r2-bucket>'
  );
}
if (!bucket.startsWith('willie-page-preview-')) {
  throw new Error('Only an isolated preview bucket may be used.');
}

const raw = await readFile(totpFile, 'utf8');
const encoded = /^INDIEAUTH_TOTP_SECRET=([A-Z2-7]+)$/m.exec(raw)?.[1];
const secret = encoded && decodeBase32(encoded);
assert(secret && secret.length >= 16, 'A valid private TOTP file is required.');

const metadataResponse = await fetch(
  `${origin}/.well-known/oauth-authorization-server`
);
assert.equal(metadataResponse.status, 200);
const metadata = (await metadataResponse.json()) as Record<string, string>;
assert.equal(new URL(metadata.authorization_endpoint).origin, origin);
assert.equal(new URL(metadata.token_endpoint).origin, origin);

const nonce = randomBytes(12).toString('hex');
const clientId = `http://localhost:8765/${nonce}/`;
const redirectUri = `${clientId}callback`;
const verifier = randomBytes(48).toString('base64url');
const state = randomBytes(24).toString('base64url');
const authorizationUrl = new URL(metadata.authorization_endpoint);
authorizationUrl.search = new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  redirect_uri: redirectUri,
  state,
  code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  code_challenge_method: 'S256',
  scope: 'profile media',
}).toString();

let accessToken = '';
let refreshToken = '';
let mediaKey = '';
try {
  const authorization = await fetch(authorizationUrl, { redirect: 'manual' });
  assert.equal(authorization.status, 302);
  const consentUrl = new URL(authorization.headers.get('location')!, origin);
  assert.equal(consentUrl.origin, origin);
  const consentPage = await fetch(consentUrl);
  assert.equal(consentPage.status, 200);
  const fields = new URLSearchParams();
  function collectInputs(node: DefaultTreeAdapterMap['node']) {
    if ('tagName' in node && node.tagName === 'input') {
      const attrs = Object.fromEntries(
        node.attrs.map((attr) => [attr.name, attr.value])
      );
      if (
        attrs.name &&
        (attrs.type === 'hidden' ||
          (attrs.type === 'checkbox' && 'checked' in attrs))
      ) {
        fields.append(attrs.name, attrs.value);
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(collectInputs);
  }
  collectInputs(parse(await consentPage.text()));
  fields.set('decision', 'approve');
  fields.set('code', totpCode(secret, totpStep(new Date())));
  const consent = await fetch(`${origin}/indieauth/consent`, {
    method: 'POST',
    headers: { Origin: origin },
    body: fields,
    redirect: 'manual',
  });
  assert.equal(consent.status, 303, `Consent returned ${consent.status}`);
  const callback = new URL(consent.headers.get('location')!);
  assert.equal(callback.origin + callback.pathname, redirectUri);
  assert.equal(callback.searchParams.get('state'), state);
  const code = callback.searchParams.get('code');
  assert(code);

  const redemption = await fetch(metadata.token_endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  assert.equal(
    redemption.status,
    200,
    `Token redemption returned ${redemption.status}`
  );
  const token = (await redemption.json()) as {
    access_token: string;
    refresh_token: string;
  };
  assert(token.access_token && token.refresh_token);
  accessToken = token.access_token;
  refreshToken = token.refresh_token;
  const userinfo = await fetch(metadata.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(userinfo.status, 200);
  assert.equal(((await userinfo.json()) as { url: string }).url, `${origin}/`);

  const original = await readFile('public/assets/headshot.jpg');
  const form = new FormData();
  form.set(
    'file',
    new File([original], 'cloudflare-acceptance.jpg', { type: 'image/jpeg' })
  );
  const upload = await fetch(`${origin}/micropub/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  assert.equal(
    upload.status,
    201,
    `Media upload returned ${upload.status}: ${await upload.text()}`
  );
  const mediaUrl = new URL(upload.headers.get('location')!);
  assert.equal(mediaUrl.origin, origin);
  assert.match(
    mediaUrl.pathname,
    /^\/media\/\d{4}\/\d{2}\/cloudflare-acceptance-[a-f0-9-]{36}\.jpg$/
  );
  mediaKey = mediaUrl.pathname.slice(1);
  const delivery = await fetch(mediaUrl);
  assert.equal(delivery.status, 200);
  assert.equal(delivery.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await delivery.arrayBuffer()), original);
  console.log(
    JSON.stringify({
      origin,
      authorization: authorization.status,
      redemption: redemption.status,
      userinfo: userinfo.status,
      upload: upload.status,
      delivery: delivery.status,
      mediaBytes: original.length,
    })
  );
} finally {
  for (const token of [accessToken, refreshToken]) {
    if (!token) continue;
    const revoke = await fetch(`${origin}/indieauth/revoke`, {
      method: 'POST',
      body: new URLSearchParams({ token }),
    });
    assert.equal(
      revoke.status,
      200,
      `Token revocation returned ${revoke.status}`
    );
  }
  if (mediaKey) {
    execFileSync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'r2',
        'object',
        'delete',
        `${bucket}/${mediaKey}`,
        '--remote',
        '--force',
      ],
      { stdio: 'pipe' }
    );
  }
}
