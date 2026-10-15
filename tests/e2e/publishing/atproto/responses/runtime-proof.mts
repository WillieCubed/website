import type {} from '@atcute/atproto';
import type {} from '@atcute/bluesky';
import assert from 'node:assert/strict';

import type { PublishingIdentity } from '../../../../../lib/atproto/config';
import type { RuntimeExpectation, Snapshot } from './types.mts';

interface Context {
  ORIGIN: string;
  runtimeExpectation: RuntimeExpectation;
  slug: string;
  did: string | undefined;
  identity: PublishingIdentity;
  values: {
    env: string;
    slug?: string | undefined;
    receipt: string;
    cleanup: boolean;
    'retained-runtime': boolean;
    'reuse-runtime': boolean;
    'reuse-runtime-revision'?: string | undefined;
    'fixture-source-journal'?: string | undefined;
    'retained-source-journal'?: string | undefined;
    'publication-journal'?: string | undefined;
  };
  retainedDocument: Snapshot | undefined;
}

export async function verifyRetainedHttp(dependencies: Readonly<Context>) {
  const revision = await fetch(`${dependencies.ORIGIN}/api/indieweb/revision`, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  assert(
    revision.ok &&
      (await revision.json()).sha === dependencies.runtimeExpectation.revision,
    'Retained evidence requires the exact authorized hosted revision.'
  );
  const page = await fetch(
    `${dependencies.ORIGIN}/writings/${dependencies.slug}`,
    {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    }
  );
  assert(page.ok, 'The retained fixture must remain publicly readable.');
  const html = await page.text();
  assert(
    html.includes(dependencies.runtimeExpectation.nonce) &&
      html.includes(
        `at://${dependencies.did}/site.standard.document/${dependencies.runtimeExpectation.documentRkey}`
      ) &&
      html.includes(dependencies.identity.publicationUri),
    'The retained fixture nonce and verification links must match the owned target.'
  );
  if (dependencies.values['reuse-runtime']) {
    const [{ parse }, { documentIsVerified }] = await Promise.all([
      import('parse5'),
      import('../../../../../lib/atproto/verification'),
    ]);
    type HtmlNode = {
      tagName?: string;
      attrs?: { name: string; value: string }[];
      childNodes?: HtmlNode[];
    };
    const all = (node: HtmlNode): HtmlNode[] => [
      node,
      ...(node.childNodes ?? []).flatMap(all),
    ];
    const nodes = all(parse(html) as HtmlNode);
    const head = nodes.find((node) => node.tagName === 'head');
    const attrs = (node: HtmlNode) =>
      Object.fromEntries(
        (node.attrs ?? []).map(({ name, value }) => [name, value])
      );
    assert(
      dependencies.retainedDocument &&
        documentIsVerified(
          dependencies.retainedDocument.value,
          dependencies.identity.publicationUri,
          `/writings/${dependencies.slug}`,
          dependencies.retainedDocument.uri,
          html
        ),
      'The reused artifact must expose the valid exact owned document head link.'
    );
    assert(
      head &&
        all(head).some(
          (node) =>
            node.tagName === 'link' &&
            attrs(node)
              .rel?.split(/\s+/)
              .includes('site.standard.publication') &&
            attrs(node).href === dependencies.identity.publicationUri
        )
    );
    assert(
      nodes.some(
        (node) =>
          node.tagName === 'time' &&
          attrs(node).class?.split(/\s+/).includes('dt-published') &&
          attrs(node).datetime === dependencies.runtimeExpectation.publishedAt
      )
    );
  }
}
