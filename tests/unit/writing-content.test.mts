import { mf2 } from 'microformats-parser';
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFragment } from 'parse5';

import { htmlText, plainTextHtml, writingText } from '@/lib/writings/content';
import {
  prepareWritingHtmlMedia,
  responseMediaHtml,
  writingAttachments,
  writingMediaHtml,
} from '@/lib/writings/media';

test('authored HTML keeps one relative inline attachment with its label and appends only missing media', () => {
  const base = 'https://example.com/writings/post';
  const writing = {
    micropub: {
      type: ['h-entry'],
      properties: {
        attachment: [
          {
            type: ['h-cite'],
            properties: {
              url: ['https://example.com/files/read.pdf?x=1&y=2'],
              name: ['A retained attachment description'],
              'x-private': [{ value: 'Retained source extension' }],
            },
          },
          'https://example.com/files/other.pdf',
        ],
        audio: ['https://example.com/files/audio.ogg'],
        video: ['https://example.com/files/movie.mp4'],
      },
    },
  };
  const original = structuredClone(writing);
  const prepared = prepareWritingHtmlMedia(
    '<p><a href="../files/read.pdf?x=1&amp;y=2">Read the paper</a>' +
      '<a href="https://example.com/ordinary">An ordinary link</a></p>' +
      '<audio><source src="../files/audio.ogg"></audio>' +
      '<iframe src="../files/movie.mp4"></iframe>',
    writingAttachments(writing),
    base
  );
  const rendered =
    prepared.html + responseMediaHtml(prepared.attachments, base);
  assert.equal((rendered.match(/read\.pdf/g) ?? []).length, 1);
  assert.match(prepared.html, /class="u-attachment">Read the paper<\/a>/);
  assert.match(
    prepared.html,
    /href="https:\/\/example.com\/ordinary" rel="nofollow ugc">An ordinary link/
  );
  assert.deepEqual(
    prepared.attachments.map((item) => item.url),
    [
      'https://example.com/files/movie.mp4',
      'https://example.com/files/other.pdf',
    ]
  );
  assert.equal((rendered.match(/<audio/g) ?? []).length, 1);
  const entry = mf2(`<article class="h-entry">${rendered}</article>`, {
    baseUrl: base,
  }).items[0];
  assert.deepEqual(entry.properties.audio, [
    'https://example.com/files/audio.ogg',
  ]);
  assert.deepEqual(entry.properties.attachment, [
    'https://example.com/files/read.pdf?x=1&y=2',
  ]);
  assert.match(rendered, /<video[^>]+controls/);
  assert.doesNotMatch(rendered, /<iframe/);
  assert.deepEqual(writing, original);

  const feedHtml = writingMediaHtml(
    {
      ...writing,
      photos: [
        { url: 'https://example.com/files/photo.png', alt: 'A photograph' },
      ],
    },
    base,
    '<p><a href="../files/read.pdf?x=1&amp;y=2">Read the paper</a></p>' +
      '<img src="../files/photo.png" alt="The inline photo description">' +
      '<audio><source src="../files/audio.ogg"></audio>'
  );
  const feedEntry = mf2(`<article class="h-entry">${feedHtml}</article>`, {
    baseUrl: base,
  }).items[0];
  assert.equal((feedHtml.match(/read\.pdf/g) ?? []).length, 1);
  assert.equal((feedHtml.match(/<img/g) ?? []).length, 1);
  assert.match(feedHtml, /Read the paper/);
  assert.match(feedHtml, /alt="The inline photo description"/);
  assert.deepEqual(feedEntry.properties.attachment, [
    'https://example.com/files/read.pdf?x=1&y=2',
    'https://example.com/files/other.pdf',
  ]);
  assert.deepEqual(feedEntry.properties.audio, [
    'https://example.com/files/audio.ogg',
  ]);
  assert.deepEqual(feedEntry.properties.video, [
    'https://example.com/files/movie.mp4',
  ]);
  assert.equal(feedEntry.properties.photo.length, 1);
  assert.doesNotMatch(feedHtml, /autoplay/);
});

test('plaintext feeds retain explicit Unicode direction and determine each value direction', () => {
  for (const body of [
    'مرحبا Alice',
    'Alice مرحبا',
    '\u200fABC שלום',
    '\u200eשלום ABC',
  ]) {
    const paragraph = parseFragment(plainTextHtml(body)).childNodes[0];
    assert.ok('attrs' in paragraph && 'childNodes' in paragraph);
    assert.deepEqual(paragraph.attrs, [{ name: 'dir', value: 'auto' }]);
    assert.equal(paragraph.childNodes[0].nodeName, '#text');
    assert.ok('value' in paragraph.childNodes[0]);
    assert.equal(paragraph.childNodes[0].value, body);
  }
});

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
