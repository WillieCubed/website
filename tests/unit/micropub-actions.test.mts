import assert from 'node:assert/strict';
import test from 'node:test';

import { readMicropubAction } from '@/lib/indieweb/micropub-actions';
import { MicropubRequestError } from '@/lib/indieweb/micropub-document';
import { site } from '@/lib/site';

const url = `${site.origin}/writings/transit-notes`;

function jsonRequest(body: unknown): Request {
  return new Request(`${site.origin}/micropub`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function formRequest(entries: [string, string][]): Request {
  return new Request(`${site.origin}/micropub`, {
    method: 'POST',
    body: new URLSearchParams(entries),
  });
}

test('readMicropubAction reads JSON updates in both delete forms', async () => {
  assert.deepEqual(
    await readMicropubAction(
      jsonRequest({
        action: 'update',
        url,
        replace: { content: ['New text.'] },
        add: { category: ['bus'] },
        delete: ['syndication'],
      })
    ),
    {
      action: 'update',
      url,
      update: {
        replace: { content: ['New text.'] },
        add: { category: ['bus'] },
        deleteProperties: ['syndication'],
        deleteValues: {},
      },
    }
  );
  const byValue = await readMicropubAction(
    jsonRequest({ action: 'update', url, delete: { category: ['transit'] } })
  );
  assert.deepEqual(byValue.action === 'update' && byValue.update.deleteValues, {
    category: ['transit'],
  });
});

test('readMicropubAction reads bracketed form updates', async () => {
  assert.deepEqual(
    await readMicropubAction(
      formRequest([
        ['action', 'update'],
        ['url', url],
        ['replace[content][]', 'New text.'],
        ['add[category][]', 'bus'],
        ['add[category][]', 'night'],
        ['delete[category][]', 'transit'],
        ['delete[]', 'photo'],
        ['access_token', 'ignored-here'],
      ])
    ),
    {
      action: 'update',
      url,
      update: {
        replace: { content: ['New text.'] },
        add: { category: ['bus', 'night'] },
        deleteProperties: ['photo'],
        deleteValues: { category: ['transit'] },
      },
    }
  );
});

test('a form field named after an Object member stays a property name', async () => {
  const action = await readMicropubAction(
    formRequest([
      ['action', 'update'],
      ['url', url],
      ['replace[__proto__][]', 'x'],
    ])
  );
  assert.ok(action.action === 'update');
  assert.deepEqual(Object.keys(action.update.replace), ['__proto__']);
  assert.equal(Object.getPrototypeOf(action.update.replace), Object.prototype);
});

test('readMicropubAction treats a body without action as a create', async () => {
  assert.deepEqual(
    await readMicropubAction(
      jsonRequest({ type: ['h-entry'], properties: { content: ['Hi'] } })
    ),
    { action: 'create' }
  );
  assert.deepEqual(await readMicropubAction(formRequest([['h', 'entry']])), {
    action: 'create',
  });
});

test('readMicropubAction refuses unknown actions and malformed updates', async () => {
  for (const body of [
    { action: 'publish', url },
    { action: 'undelete', url },
    { action: 'update' },
    { action: 'update', url, replace: { content: 'x' } },
    { action: 'update', url, delete: [1] },
  ]) {
    await assert.rejects(
      readMicropubAction(jsonRequest(body)),
      MicropubRequestError,
      JSON.stringify(body)
    );
  }
  await assert.rejects(
    readMicropubAction(
      formRequest([
        ['action', 'undelete'],
        ['url', url],
      ])
    ),
    { description: 'The action "undelete" is not supported.' }
  );
});
