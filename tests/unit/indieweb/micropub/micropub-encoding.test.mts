import assert from 'node:assert/strict';
import test from 'node:test';

import { parseMicropubCreateRequest } from '@/lib/indieweb/micropub/parse';

const json = (properties: Record<string, unknown[]>, type = ['h-entry']) =>
  parseMicropubCreateRequest(
    new Request('https://example.com/micropub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, properties }),
    })
  );
const form = (pairs: Array<[string, string]>) =>
  parseMicropubCreateRequest(
    new Request('https://example.com/micropub', {
      method: 'POST',
      body: new URLSearchParams(pairs),
    })
  );

test('form and JSON readers preserve their authored text and citation spelling rules', async () => {
  const fields: Array<[string, string]> = [
    ['content', 'A reply.'],
    ['name', '  A name  '],
    ['in-reply-to', ' HTTPS://EXAMPLE.COM/Reply '],
    ['syndication', ' HTTPS://EXAMPLE.COM/Copy '],
  ];
  const [formEntry, jsonEntry] = await Promise.all([
    form(fields),
    json(Object.fromEntries(fields.map(([key, value]) => [key, [value]]))),
  ]);
  assert.equal(formEntry.name, 'A name');
  assert.equal(jsonEntry.name, '  A name  ');
  assert.equal(formEntry.inReplyTo, 'HTTPS://EXAMPLE.COM/Reply');
  assert.equal(jsonEntry.inReplyTo, 'https://example.com/Reply');
  assert.deepEqual(formEntry.syndication, ['HTTPS://EXAMPLE.COM/Copy']);
  assert.deepEqual(jsonEntry.syndication, ['https://example.com/Copy']);
  assert.equal(formEntry.postType, 'reply');
  assert.equal(jsonEntry.postType, 'reply');
});

test('form bracket fields retain their property bag without becoming single-valued fields', async () => {
  const entry = await form([
    ['content', 'A note.'],
    ['name[]', 'Bracket title'],
    ['post-status[]', 'draft'],
    ['category[]', ' note '],
  ]);
  assert.equal(entry.name, undefined);
  assert.equal(entry.postStatus, undefined);
  assert.deepEqual(entry.properties?.name, ['Bracket title']);
  assert.deepEqual(entry.properties?.['post-status'], ['draft']);
  assert.deepEqual(entry.categories, ['note']);
});

test('JSON retains embedded text values and secondary h-event metadata', async () => {
  const entry = await json(
    {
      content: ['Event note.'],
      name: [{ value: 'Event name' }],
      'in-reply-to': [
        {
          type: ['h-cite'],
          properties: { url: ['https://example.com/event'] },
        },
      ],
      start: ['2026-10-23T12:00:00Z'],
      'post-status': ['draft'],
    },
    ['h-entry', 'h-event']
  );
  assert.equal(entry.h, 'entry');
  assert.equal(entry.name, 'Event name');
  assert.equal(entry.event?.start, '2026-10-23T12:00:00Z');
  assert.equal(entry.inReplyTo, 'https://example.com/event');
  assert.equal(entry.postStatus, 'draft');
});

test('both encodings sanitize HTML in the body and retained property bag', async () => {
  const html = '<p onclick="bad()">A note.<script>bad()</script></p>';
  const entries = await Promise.all([
    json({ content: [{ html }] }),
    form([['content[html]', html]]),
  ]);
  for (const entry of entries) {
    assert.equal(entry.contentFormat, 'html');
    assert.equal(entry.content, '<p>A note.</p>');
    assert.deepEqual(entry.properties?.content, [{ html: '<p>A note.</p>' }]);
  }
});

test('JSON property validation retains arbitrary extension keys and nested objects', async () => {
  const properties = JSON.parse(
    '{"content":["An extension note."],"__proto__":[{"value":"extension"}],"constructor":["kept"],"vendor-field":[{"nested":{"label":"kept"}}]}'
  ) as Record<string, unknown[]>;
  const entry = await json(properties);
  assert.equal(Object.hasOwn(entry.properties!, '__proto__'), true);
  assert.deepEqual(entry.properties?.['__proto__'], [{ value: 'extension' }]);
  assert.deepEqual(entry.properties?.['constructor'], ['kept']);
  assert.deepEqual(entry.properties?.['vendor-field'], [
    { nested: { label: 'kept' } },
  ]);
});

test('invalid values stay invalid when an extension uses an Object member name', async () => {
  for (const name of ['__proto__', 'constructor']) {
    const properties = Object.fromEntries([
      ['content', ['A note.']],
      [name, [42]],
    ]);
    await assert.rejects(json(properties), /invalid_request/);
  }
});
