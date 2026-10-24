import { GET } from '@/app/entities.json/route';
import assert from 'node:assert/strict';
import test from 'node:test';

test('an unchanged preview registry validates without transferring the body', async () => {
  const first = await GET(new Request('https://willie.page/entities.json'));
  assert.equal(first.status, 200);
  assert.match(first.headers.get('ETag') ?? '', /^".+"$/);
  const second = await GET(
    new Request('https://willie.page/entities.json', {
      headers: { 'If-None-Match': first.headers.get('ETag')! },
    })
  );
  assert.equal(second.status, 304);
  assert.equal(await second.text(), '');
  assert.equal(
    second.headers.get('Cache-Control'),
    first.headers.get('Cache-Control')
  );
});
