import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFragment } from 'parse5';

import { htmlText, plainTextHtml, writingText } from '@/lib/writings/content';

test('literal Micropub text preserves entity spellings, code and comments in feeds', () => {
  const body =
    '&copy; <!-- example --> <script>code()</script>\nconst x = 1 < 2;';
  const fragment = parseFragment(plainTextHtml(body));
  const paragraph = fragment.childNodes[0];
  assert.ok('childNodes' in paragraph);
  const text = paragraph.childNodes
    .map((node) =>
      'value' in node ? node.value : node.nodeName === 'br' ? '\n' : ''
    )
    .join('');
  assert.equal(text, body);
  assert.equal(writingText(body, { contentFormat: 'text' }), body);
});
test('HTML text export preserves code, image descriptions, tables and paragraphs', () => {
  assert.equal(htmlText('<h1>Heading</h1><p>Body</p>'), 'Heading\nBody');
  const text = htmlText(
    '<p>Hello</p><pre><code>const x = 1;</code></pre><img src="/photo.png" alt="A garden"><table><tr><td>A</td><td>B</td></tr></table>'
  );
  assert.match(text, /const x = 1;/);
  assert.match(text, /A garden/);
  assert.match(text, /A\s+B/);
});
