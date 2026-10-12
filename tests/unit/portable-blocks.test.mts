import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  auditPortableContent,
  decodePortableMarkdown,
  renderFeedHtml,
} from '@/lib/feeds/html';

registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: 'export default {};', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { default: StudioBlock, approvedBundlePath } =
  await import('@/components/mdx/StudioBlock');

const id = '4f1f624b-2615-4008-9086-124af902c444';
const version = '1.0.0';
const src = `/generated-blocks/${id}/${version}-${'a'.repeat(20)}.html`;
const encode = (value: string) => Buffer.from(value).toString('base64url');
const portable = encode(
  '**A readable result**\n\n[Details](/about)\n\n![Diagram](/diagram.png)'
);

test('widget feeds retain semantic alternatives, absolute URLs, and the canonical interactive original', async () => {
  const html = await renderFeedHtml(
    `<StudioBlock id="${id}" version="${version}" src="${src}" portable="${portable}" />`,
    '/writings/example'
  );
  assert.match(html, /<strong>A readable result<\/strong>/);
  assert.match(html, /href="https:\/\/willie.page\/about"/);
  assert.match(html, /src="https:\/\/willie.page\/diagram.png"/);
  assert.match(html, /href="https:\/\/willie.page\/writings\/example"/);
  assert.doesNotMatch(html, /iframe|generated-blocks/);
});

test('portable content rejects executable or noncanonical input rather than silently dropping it', async () => {
  for (const input of [
    '',
    ' ',
    '{process.env.SECRET}',
    '<script>alert(1)</script>',
    'import Secret from "private"',
  ]) {
    assert.equal(decodePortableMarkdown(encode(input)), null, input);
  }
  for (const encoded of ['!!!', 'YQ==', '_w'])
    assert.equal(decodePortableMarkdown(encoded), null);
  assert.equal(
    auditPortableContent('<StudioBlock portable="e30" />').length,
    1
  );
  await assert.rejects(
    renderFeedHtml('<StudioBlock portable="e30" />'),
    /missing valid portable/
  );
});

test('only the exact immutable public bundle path is admitted', () => {
  assert.equal(approvedBundlePath(id, version, src), true);
  for (const candidate of [
    `https://evil.example${src}`,
    `${src}?x=1`,
    `${src}/../other.html`,
    src.replace(id, 'other'),
    src.replace('a'.repeat(20), 'a'.repeat(19)),
  ]) {
    assert.equal(approvedBundlePath(id, version, candidate), false, candidate);
  }
  assert.equal(approvedBundlePath('../secret', version, src), false);
  assert.equal(approvedBundlePath(id, '../secret', src), false);
});

test('the public renderer retains its readable alternative and opaque sandbox', () => {
  const rendered = StudioBlock({
    id,
    version,
    src,
    portable,
    title: 'Diagram',
  });
  const children = rendered.props.children;
  const iframe = children[0];
  assert.equal(iframe.props.sandbox, 'allow-scripts');
  assert.equal(iframe.props.referrerPolicy, 'no-referrer');
  assert.equal(iframe.props.title, 'Diagram');
  assert.equal(children[1].props.id, iframe.props['aria-describedby']);
  assert.equal(
    children[1].props.children[0].props.children,
    decodePortableMarkdown(portable)
  );
  assert.equal(
    StudioBlock({ id, version, src: 'https://evil.example', portable }).props
      .children[0],
    false
  );
});
