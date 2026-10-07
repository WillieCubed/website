import assert from 'node:assert/strict';
import test from 'node:test';

import { createOAuthFetch, oauthFetch } from '@/lib/atproto/oauth-fetch';
import {
  documentIsVerified,
  hasDocumentVerification,
  publicationIsVerified,
} from '@/lib/atproto/verification';

const publication =
  'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/site.standard.publication/3khuwc44c222b';
const document = publication.replace('publication', 'document');

test('targets require both a valid record and a matching verification response', () => {
  const record = {
    $type: 'site.standard.publication',
    name: 'Test',
    url: 'https://site.example/',
  };
  assert.ok(
    publicationIsVerified(
      record,
      'https://site.example',
      publication,
      publication + '\n'
    )
  );
  assert.ok(
    !publicationIsVerified(
      record,
      'https://site.example',
      publication,
      'at://wrong'
    )
  );
  assert.ok(
    !publicationIsVerified(
      { ...record, url: 'https://other.example' },
      'https://site.example',
      publication,
      publication
    )
  );
});

test('a document must belong to this publication and verify at its exact path', () => {
  const record = {
    $type: 'site.standard.document',
    site: publication,
    title: 'A post',
    path: '/writings/post',
    publishedAt: '2026-10-06T12:00:00Z',
  };
  const html = `<head><link href="${document}" rel="site.standard.document"></head>`;
  assert.ok(
    documentIsVerified(record, publication, record.path, document, html)
  );
  assert.ok(
    !documentIsVerified(
      { ...record, site: 'https://other.example' },
      publication,
      record.path,
      document,
      html
    )
  );
  assert.ok(
    !documentIsVerified(record, publication, '/writings/other', document, html)
  );
  assert.ok(!hasDocumentVerification(`<script>${html}</script>`, document));
  assert.ok(
    !hasDocumentVerification(
      `<body><link rel="site.standard.document" href="${document}"></body>`,
      document
    )
  );
});

test('OAuth fetch rejects non-HTTPS URLs and embedded credentials before connecting', async () => {
  await assert.rejects(oauthFetch('http://127.0.0.1/token'), /public HTTPS/);
  await assert.rejects(
    oauthFetch('https://user:secret@example.com/token'),
    /public HTTPS/
  );
});

test('OAuth transport preserves signed SDK Request methods, credentials, bodies and cancellation', async () => {
  let called = false;
  const signedFetch = createOAuthFetch(async (url, init) => {
    called = true;
    assert.equal(url.href, 'https://provider.example/token');
    assert.equal(init.method, 'POST');
    const headers = new Headers(init.headers);
    assert.equal(headers.get('authorization'), 'DPoP secret');
    assert.equal(headers.get('dpop'), 'signed-proof');
    assert.equal(
      await new Response(init.body).text(),
      'grant_type=refresh_token'
    );
    assert.ok(init.signal);
    assert.equal(init.redirect, 'error');
    return new Response('{"ok":true}');
  });
  const response = await signedFetch(
    new Request('https://provider.example/token', {
      method: 'POST',
      headers: { authorization: 'DPoP secret', dpop: 'signed-proof' },
      body: 'grant_type=refresh_token',
    })
  );
  assert.ok(called);
  assert.deepEqual(await response.json(), { ok: true });
});
