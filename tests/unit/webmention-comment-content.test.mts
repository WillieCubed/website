import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMMENT_TEXT_LIMIT,
  commentHtml,
  commentText,
  sanitizeCommentHtml,
} from '@/lib/indieweb/comment-content';

const base = 'https://alice.example/notes/42';

test('directional HTML preserves overrides and isolates without executable attributes', () => {
  const html =
    '<div dir="rtl" onclick="bad()">مرحبا <span dir="ltr">Alice</span> ' +
    '<bdi>שלום</bdi><bdo dir="rtl">ABC</bdo>' +
    '<a dir="auto" href="/reply">תגובה</a></div>';
  const clean = sanitizeCommentHtml(html, base);
  assert.equal(
    clean,
    '<div dir="rtl">مرحبا <span dir="ltr">Alice</span> ' +
      '<bdi>שלום</bdi><bdo dir="rtl">ABC</bdo>' +
      '<a href="https://alice.example/reply" rel="nofollow ugc" dir="auto">תגובה</a></div>'
  );
  assert.equal(commentHtml(clean, base), clean);
  assert.equal(
    sanitizeCommentHtml(
      '<p dir="invalid">Text</p><bdo dir="auto">ABC</bdo>',
      base
    ),
    '<p>Text</p><bdo>ABC</bdo>'
  );
  assert.equal(
    sanitizeCommentHtml(
      '<p dir="RTL">مرحبا</p><a dir="LTR" href="javascript:bad()">Alice</a>',
      base
    ),
    '<p dir="rtl">مرحبا</p><span dir="ltr">Alice</span>'
  );
});

test('the allowed elements survive as written', () => {
  const html =
    '<p>One <em>two</em> <strong>three</strong><br>four</p>' +
    '<blockquote><p>Quoted</p></blockquote>' +
    '<p><code>x = 1</code></p><ul><li>a</li></ul><ol><li>b</li></ol>';
  // sanitize-html closes void elements XHTML-style.
  assert.equal(sanitizeCommentHtml(html, base), html.replace('<br>', '<br />'));
  assert.equal(commentHtml(html, base), html);
});

test('bold and italic become strong and em', () => {
  assert.equal(
    sanitizeCommentHtml('<b>bold</b> <i>italic</i>', base),
    '<strong>bold</strong> <em>italic</em>'
  );
});

test('script, style, and embedded documents go with their text', () => {
  const html =
    '<p>Hi</p><script>alert(1)</script><style>body{display:none}</style>' +
    '<iframe src="https://evil.example/">frame</iframe>' +
    '<svg onload="alert(1)"><text>svg</text></svg>' +
    '<noscript>ns</noscript><template>tpl</template>';
  assert.equal(sanitizeCommentHtml(html, base), '<p>Hi</p>');
});

test('event handlers, styles, and every other attribute are dropped', () => {
  assert.equal(
    sanitizeCommentHtml(
      '<p style="color:red" onclick="alert(1)" class="x" id="y">Hi</p>' +
        '<img src="x" onerror="alert(1)">' +
        '<a href="https://ok.example/" onmouseover="alert(1)" target="_blank" style="position:fixed">ok</a>',
      base
    ),
    '<p>Hi</p><img src="https://alice.example/notes/x" loading="lazy" alt="" /><a href="https://ok.example/" rel="nofollow ugc">ok</a>'
  );
});

test('a link that is not http(s) keeps its text and loses the link', () => {
  for (const href of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java&#x09;script:alert(1)',
    ' javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'mailto:ada@example.com',
  ]) {
    assert.equal(
      sanitizeCommentHtml(`<a href="${href}">click</a>`, base),
      'click',
      href
    );
  }
});

test('links resolve against the reply and always carry nofollow ugc', () => {
  assert.equal(
    sanitizeCommentHtml(
      '<a href="/about" rel="me author">About</a> <a href="https://x.example/">X</a>',
      base
    ),
    '<a href="https://alice.example/about" rel="nofollow ugc">About</a> ' +
      '<a href="https://x.example/" rel="nofollow ugc">X</a>'
  );
});

test('a reply over the limit is cut with an ellipsis and its tags closed', () => {
  const long = 'word '.repeat(COMMENT_TEXT_LIMIT);
  const html = commentHtml(
    `<p>Start</p><blockquote><p><strong>${long}</strong></p></blockquote><p>Never shown</p>`,
    base
  );
  assert.ok(html);
  assert.match(html, /^<p>Start<\/p><blockquote><p><strong>word /);
  assert.match(html, /…<\/strong><\/p><\/blockquote>$/);
  assert.doesNotMatch(html, /Never shown/);
  const text = html.replace(/<[^>]+>/g, '');
  assert.ok(text.length <= COMMENT_TEXT_LIMIT + 1, `${text.length} chars`);
});

test('a reply under the limit is kept whole', () => {
  assert.equal(commentHtml('<p>Short.</p>', base), '<p>Short.</p>');
});

test('markup with nothing readable left is dropped', () => {
  assert.equal(commentHtml('<script>alert(1)</script>', base), undefined);
  assert.equal(commentHtml('<p></p><br>', base), undefined);
  assert.equal(commentHtml('<p></p>'.repeat(10_000) + 'x', base), undefined);
});

test('plain text stays text and is cut at the limit', () => {
  assert.equal(commentText('  1 < 2 & 3  '), '1 < 2 & 3');
  assert.equal(commentText('   '), undefined);
  const cut = commentText('word '.repeat(COMMENT_TEXT_LIMIT));
  assert.ok(cut?.endsWith('…'));
  assert.ok((cut?.length ?? 0) <= COMMENT_TEXT_LIMIT + 1);
});

test('native response media keeps controls and drops autoplay and executable sources', () => {
  const clean = sanitizeCommentHtml(
    '<audio src="clip.mp3" autoplay onplay="bad()"></audio><video src="clip.mp4" poster="cover.jpg" autoplay></video><img src="javascript:bad()" onerror="bad()">',
    base
  );
  assert.match(clean, /controls/);
  assert.match(clean, /preload="none"/);
  assert.match(clean, /https:\/\/alice.example\/notes\/clip.mp3/);
  assert.doesNotMatch(clean, /autoplay|onplay|onerror|javascript:/);
});

test('attachment actions retain only their recognized media class through repeated sanitizing', () => {
  const html =
    '<p><a class="arbitrary u-attachment" href="files/reply.pdf">A PDF attachment</a> and <a class="arbitrary" href="https://example.com/">a citation</a>.</p>';
  const once = sanitizeCommentHtml(html, 'https://reply.example/post');
  assert.match(once, /class="u-attachment"/);
  assert.doesNotMatch(once, /arbitrary/);
  assert.equal(sanitizeCommentHtml(once, 'https://reply.example/post'), once);
  assert.equal((once.match(/class=/g) ?? []).length, 1);
});
