import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  documentSource,
  exportMdx,
  importMdx,
  parseDraftContent,
  validatePublication,
} from '../../../lib/studio/document';
import type { DraftContent } from '../../../lib/studio/types';

test('import and export preserve unfamiliar MDX imports, expressions and frontmatter', () => {
  const raw =
    '---\ntitle: My writing\npublished: 2026-10-10\ncustom: keep-me\n---\n\nimport Thing from "./thing";\n\n<Thing value={1 + 2} />\n';
  const body = importMdx(raw);
  const out = exportMdx(body, 'my-writing', 'revision-1');
  assert.match(out, /custom: keep-me/);
  assert.match(out, /import Thing from "\.\/thing";/);
  assert.match(out, /<Thing value=\{1 \+ 2\} \/>/);
  assert.match(out, /studioRevision: revision-1/);
});

test('publication blocks undescribed images and missing portable component alternatives', async () => {
  const body: DraftContent = {
    title: 'Test',
    description: '',
    postType: 'article',
    tags: [],
    document: {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'https://example.com/a.png', alt: '' } },
      ],
    },
  };
  assert.ok(
    (await validatePublication(body)).some((x) => /alt|description/i.test(x))
  );
  body.document.content = [
    { type: 'catalogBlock', attrs: { id: 'unknown', version: '1', props: {} } },
  ];
  assert.ok(
    (await validatePublication(body)).some((x) =>
      /catalog|approved|portable/i.test(x)
    )
  );
});

test('structured prose escapes literal MDX and unsafe link targets', () => {
  const body: DraftContent = {
    title: 'Test',
    description: '',
    postType: 'note',
    tags: [],
    document: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '<script>{x}</script>',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    },
  };
  const output = exportMdx(body, 'test');
  assert.doesNotMatch(output, /javascript:|<script>|\{x\}/);
  assert.match(output, /&lt;script&gt;/);
});

test('publication rejects executable attributes, raw scripts and unsafe imported links', async () => {
  for (const source of [
    '<Figure src="https://example.com/x" alt="x" onLoad={alert(1)} />',
    '<script>alert(1)</script>',
    '<a href="javascript:alert(1)">link</a>',
    '<Unknown />',
    '<div {...props} />',
  ]) {
    const body = importMdx('---\ntitle: Test\n---\n' + source);
    assert.ok((await validatePublication(body)).length > 0, source);
  }
});

test('export preserves imported Micropub interaction post types', () => {
  const body = importMdx(
    '---\npostType: reply\ninReplyTo: https://example.com/post\n---\nA response.'
  );
  assert.match(exportMdx(body, 'response'), /postType: reply/);
});

test('invalid formatting cannot poison a saved document head', () => {
  const body = importMdx('Plain writing');
  for (const node of [
    { type: 'text', text: 'x', marks: {} },
    { type: 'text', text: 'x', marks: [null] },
    { type: 'paragraph', attrs: [] },
  ]) {
    body.document.content = [node as never];
    assert.throws(() => parseDraftContent(body), /Invalid/);
  }
});

test('structured export preserves nested block separators, table escaping and code fences', () => {
  const document = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Heading' }],
      },
      {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'First' },
              { type: 'hardBreak' },
              { type: 'text', text: 'Second' },
            ],
          },
        ],
      },
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Third' }] },
            ],
          },
        ],
      },
      {
        type: 'codeBlock',
        attrs: { language: 'ts' },
        content: [{ type: 'text', text: '```inside' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'text', text: 'a|b' }] },
              {
                type: 'tableCell',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'c' }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  assert.equal(
    documentSource(document),
    [
      '## Heading',
      '> First  \n> Second',
      '3. Third',
      '````ts\n```inside\n````',
      '| a\\|b | c |\n| --- | --- |',
    ].join('\n\n')
  );
});

test('text export retains mark order and escapes link destinations', () => {
  assert.equal(
    documentSource({
      type: 'text',
      text: 'a`b',
      marks: [
        { type: 'bold' },
        { type: 'code' },
        { type: 'italic' },
        { type: 'link', attrs: { href: 'https://example.com/a)b' } },
      ],
    }),
    '[*`a\\`b`*](https://example.com/a%29b)'
  );
  assert.throws(
    () => documentSource({ type: '__proto__' }),
    /Unsupported writing node/
  );
});

test('draft validation keeps error priority, depth, and preserved metadata', () => {
  const body = importMdx('Writing');
  const rejected = (value: unknown, message: string) =>
    assert.throws(
      () => parseDraftContent(value),
      (error: unknown) =>
        error instanceof Error &&
        'status' in error &&
        error.status === 400 &&
        error.message === message
    );
  rejected(
    { ...body, title: 1, document: { type: 'unsupported' } },
    'Invalid writing fields.'
  );
  rejected(
    {
      ...body,
      document: { type: 'doc', attrs: [], marks: {}, text: 1, content: {} },
    },
    'Invalid document attributes.'
  );
  rejected(
    { ...body, document: { type: 'doc', marks: {}, text: 1, content: {} } },
    'Invalid text formatting.'
  );
  rejected(
    { ...body, document: { type: 'doc', text: 1, content: {} } },
    'Invalid text.'
  );
  rejected(
    { ...body, document: { type: 'doc', content: {} } },
    'Invalid document structure.'
  );
  let node = { type: 'paragraph' } as DraftContent['document'];
  for (let index = 0; index < 50; index++)
    node = { type: 'paragraph', content: [node] };
  rejected(
    { ...body, document: { type: 'doc', content: [node] } },
    'Unsupported document node.'
  );
  rejected(
    { ...body, originalSource: 'x'.repeat(1_000_000) },
    'The writing is invalid or too large.'
  );
  const parsed = parseDraftContent({ ...body, extra: 'preserved' });
  assert.equal((parsed as unknown as { extra: string }).extra, 'preserved');
  assert.notEqual(parsed.document, body.document);
});
