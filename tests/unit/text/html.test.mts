import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeHtml } from '@/lib/text/html';

test('escapeHtml escapes every character that can end text or a quoted attribute', () => {
  assert.equal(
    escapeHtml(`<a href="x">Tom & Jerry's</a>`),
    '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;'
  );
});

test('escapeHtml renders missing values as empty text', () => {
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(42), '42');
});
