import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/lib/site';
import { whoamiLines, whoamiResponse } from '@/lib/whoami';

function value(lines: Array<[string, string]>, label: string) {
  return lines.find(([key]) => key === label)?.[1];
}

test('whoamiLines reads the visitor address from the first proxy hop', () => {
  const lines = whoamiLines(
    new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })
  );

  assert.equal(value(lines, 'ip'), '203.0.113.9');
});

test('whoamiLines prefers cf-connecting-ip when Cloudflare fronts the site', () => {
  const lines = whoamiLines(
    new Headers({
      'cf-connecting-ip': '198.51.100.7',
      'x-forwarded-for': '203.0.113.9',
    })
  );

  assert.equal(value(lines, 'ip'), '198.51.100.7');
});

test('whoamiLines decodes the percent-encoded city Vercel sends', () => {
  const lines = whoamiLines(
    new Headers({
      'x-vercel-ip-city': 'Las%20Vegas',
      'x-vercel-ip-country': 'US',
      'x-vercel-ip-country-region': 'NV',
      'x-vercel-id': 'sfo1::iad1::abcde-1',
    })
  );

  assert.equal(value(lines, 'city'), 'Las Vegas');
  assert.equal(value(lines, 'country'), 'US');
  assert.equal(value(lines, 'region'), 'NV');
  assert.equal(value(lines, 'edge'), 'sfo1::iad1::abcde-1');
});

test('whoamiLines reports the connection details Cloudflare exposes on request.cf', () => {
  const lines = whoamiLines(new Headers({ 'cf-ray': '8a1b2c3d4e5f-LAS' }), {
    httpProtocol: 'HTTP/3',
    tlsVersion: 'TLSv1.3',
    tlsCipher: 'AEAD-AES128-GCM-SHA256',
    colo: 'LAS',
    asn: 7018,
    asOrganization: 'AT&T Services',
    clientTcpRtt: 12,
  });

  assert.equal(value(lines, 'http'), 'HTTP/3');
  assert.equal(value(lines, 'tls'), 'TLSv1.3 AEAD-AES128-GCM-SHA256');
  assert.equal(value(lines, 'edge'), 'LAS');
  assert.equal(value(lines, 'ray'), '8a1b2c3d4e5f-LAS');
  assert.equal(value(lines, 'network'), 'AS7018 AT&T Services');
  assert.equal(value(lines, 'rtt'), '12 ms');
});

test('whoamiLines leaves out what the host does not say', () => {
  assert.deepEqual(whoamiLines(new Headers()), []);
});

test('whoamiResponse prints the lines and is never cached', async () => {
  const response = whoamiResponse(
    new Request(`${site.origin}/whoami`, {
      headers: {
        'x-forwarded-for': '203.0.113.9',
        'user-agent': 'curl/8.7.1',
      },
    })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.text();
  assert.match(body, /203\.0\.113\.9/);
  assert.match(body, /curl\/8\.7\.1/);
});
