import { expect, test } from '@playwright/test';

test('the production server isolates terminal and HTML homepage responses', async ({
  request,
}) => {
  for (const headers of [
    { Accept: '*/*', 'User-Agent': 'curl/8.10.1' },
    { Accept: 'text/plain', 'User-Agent': 'independent-client' },
  ]) {
    const response = await request.get('/', { headers });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['cdn-cache-control']).toBe('no-store');
    expect(response.headers().vary).toContain('Accept');
    const body = await response.text();
    expect(body).toContain('W I L L I E C U B E D');
    expect(body.replace(/\s+/g, ' ')).toContain(
      'One tool for planning, scheduling, and tracking every kind of work.'
    );
    expect(body.includes(String.fromCharCode(27))).toBe(
      headers.Accept !== 'text/plain'
    );
    const head = await request.head('/', { headers });
    expect(head.headers()['content-type']).toContain('text/plain');
    expect(await head.body()).toHaveLength(0);
  }
  const htmlRequests: Record<string, string>[] = [
    { Accept: 'text/html', 'User-Agent': 'curl/8.10.1' },
    { Accept: '*/*', 'User-Agent': 'curl/8.10.1', 'X-Original': 'true' },
    { Accept: '*/*', 'User-Agent': 'independent-client' },
    { Accept: 'text/plain;charset=iso-8859-1;q=1, text/html;q=0.5' },
  ];
  for (const headers of htmlRequests) {
    const response = await request.get('/', { headers });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['cdn-cache-control']).toBe('no-store');
    expect(await response.text()).toContain('<!DOCTYPE html>');
  }
});
