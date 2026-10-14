import assert from 'node:assert/strict';
import test from 'node:test';

import {
  websitePreview,
  websitePreviewBody,
} from '../../../lib/studio/preview.ts';
import type {
  ComponentProposal,
  DraftContent,
  EditorNode,
} from '../../../lib/studio/types.ts';

const body = (...content: EditorNode[]): DraftContent => ({
  title: 'Preview',
  description: '',
  tags: [],
  postType: 'article',
  document: { type: 'doc', content },
});
test('website callouts and figures render visual structure with escaped content and safe image URLs', async () => {
  const html = await websitePreview(
    body(
      {
        type: 'catalogBlock',
        attrs: {
          id: 'callout',
          version: '1',
          props: { title: '<script>bad</script>' },
          children: 'A **clear** thought.',
        },
      },
      {
        type: 'catalogBlock',
        attrs: {
          id: 'figure',
          version: '1',
          props: { src: 'javascript:alert(1)', alt: 'x' },
        },
      }
    ),
    'preview'
  );
  assert.match(html, /bg-primary-container text-on-primary-container/);
  assert.match(html, /role="note"/);
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(html, /<strong>clear<\/strong>/);
  assert.doesNotMatch(html, /javascript:|<script>/);
});
test('imported MDX is parsed as portable content and never executes expressions or scripts', async () => {
  const html = await websitePreview(
    body({
      type: 'mdxSource',
      attrs: {
        source:
          '<script>globalThis.__studioUnsafe = true</script>\n\n{process.env.SECRET}',
      },
    }),
    'preview'
  );
  assert.equal(
    (globalThis as Record<string, unknown>).__studioUnsafe,
    undefined
  );
  assert.doesNotMatch(html, /<script>|SECRET_VALUE/);
});
test('generated components require an approved exact version and run only in opaque CSP sandbox', async () => {
  const proposal: ComponentProposal = {
    id: 'generated',
    version: '1.0.0',
    name: 'Counter',
    description: 'Example',
    source:
      "import React from 'react'; export default function Counter({label}) { return <p>{label}</p>; }",
    properties: {},
    example: {},
    portableHtml: '<p>Example</p>',
    portableText: 'Example',
    accessibility: 'Text',
    status: 'proposed',
  };
  const node: EditorNode = {
    type: 'catalogBlock',
    attrs: {
      id: 'generated',
      version: '1.0.0',
      props: { label: 'Custom value' },
    },
  };
  assert.doesNotMatch(
    await websitePreview(body(node), 'preview', async () => proposal),
    /<iframe/
  );
  proposal.status = 'approved';
  const html = await websitePreview(
    body(node),
    'preview',
    async () => proposal
  );
  assert.match(html, /sandbox="allow-scripts"/);
  assert.match(html, /h-96 w-full rounded-lg border border-outline-variant/);
  assert.match(html, /<figcaption[^>]*><p[^>]*>Example<\/p>/);
  assert.doesNotMatch(html, /allow-same-origin/);
  assert.match(html, /connect-src &#39;none&#39;/);
  assert.match(html, /Custom value/);
  proposal.version = '2.0.0';
  assert.doesNotMatch(
    await websitePreview(body(node), 'preview', async () => proposal),
    /<iframe/
  );
});

test('native body HTML excludes document styles, scripts and executable imported attributes', async () => {
  const html = await websitePreviewBody(
    body({
      type: 'mdxSource',
      attrs: {
        source:
          '<style>body{display:none}</style>\n\n<img src="https://example.invalid/x" onerror="alert(1)" />\n\n<script>alert(1)</script>\n\nReadable **prose**.',
      },
    }),
    'native'
  );
  assert.match(html, /Readable \*\*prose\*\*/);
  assert.doesNotMatch(html, /<(?:style|script|meta|link)\b|<[^>]+\sonerror=/i);
});
