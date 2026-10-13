import sanitizeHtml from 'sanitize-html';

import { renderFeedHtml } from '@/lib/feeds/html';

import { catalogEntry } from './catalog';
import { compileSandbox } from './components';
import { documentSource } from './document';
import { getStudioStore } from './store';
import type { ComponentProposal, DraftContent, EditorNode } from './types';

const escape = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
function imageUrl(value: unknown): string {
  const url = String(value ?? '');
  return /^(?:https?:\/\/|\/(?!\/))/i.test(url) ? url : '';
}
function clean(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'figure',
      'figcaption',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      '*': ['id'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
  });
}

/** Renders data-only website blocks. Imported MDX passes through the feed parser,
 * never a JavaScript compiler. Only explicitly approved component source is bundled,
 * and its output runs inside an opaque sandbox with its own network-denying CSP. */
export async function websitePreviewBody(
  body: DraftContent,
  slug: string,
  lookupProposal: (id: string) => Promise<ComponentProposal | null> = (id) =>
    getStudioStore().proposal(id)
): Promise<string> {
  const canonical = `https://willie.page/writings/${encodeURIComponent(slug)}`;
  async function prose(source: string) {
    try {
      return clean(await renderFeedHtml(source, canonical));
    } catch {
      return `<pre>${escape(source)}</pre>`;
    }
  }
  async function render(node: EditorNode): Promise<string> {
    if (node.type === 'doc')
      return (await Promise.all((node.content ?? []).map(render))).join('\n');
    const containers: Record<string, string> = {
      blockquote: 'blockquote',
      bulletList: 'ul',
      orderedList: 'ol',
      listItem: 'li',
      table: 'table',
      tableRow: 'tr',
      tableCell: 'td',
      tableHeader: 'th',
    };
    const tag = containers[node.type];
    if (tag)
      return `<${tag}>${(await Promise.all((node.content ?? []).map(render))).join('\n')}</${tag}>`;
    const attrs = node.attrs ?? {};
    if (node.type === 'image') {
      const src = imageUrl(attrs.src);
      return src
        ? `<figure class="my-8"><div class="overflow-hidden rounded-lg"><img width="800" height="600" decoding="async" loading="lazy" class="h-auto w-full object-cover" src="${escape(src)}" alt="${escape(attrs.alt)}"></div>${attrs.title ? `<figcaption class="mt-3 text-center text-body-small text-on-surface-variant">${escape(attrs.title)}</figcaption>` : ''}</figure>`
        : '<p class="fallback">Choose an image to preview this figure.</p>';
    }
    if (node.type !== 'catalogBlock') return prose(documentSource(node));
    const entry = catalogEntry(String(attrs.id), String(attrs.version));
    const props =
      attrs.props && typeof attrs.props === 'object'
        ? (attrs.props as Record<string, unknown>)
        : {};
    if (entry?.id === 'figure') {
      const src = imageUrl(props.src);
      return src
        ? `<figure class="my-8"><div class="overflow-hidden rounded-lg"><img width="800" height="600" decoding="async" loading="lazy" class="h-auto w-full object-cover" src="${escape(src)}" alt="${escape(props.alt)}"></div>${props.caption ? `<figcaption class="mt-3 text-center text-body-small text-on-surface-variant">${escape(props.caption)}</figcaption>` : ''}</figure>`
        : '<p class="fallback">Choose an image to preview this figure.</p>';
    }
    if (entry?.id === 'callout')
      // Match the public Callout note variant, including its decorative mark.
      return `<div class="my-6 rounded-lg border-l-4 p-4 border-primary bg-primary-container text-on-primary-container" role="note"><div class="flex items-start gap-3"><svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><div class="flex-1"><p class="mb-1 text-sm font-semibold text-primary">${escape(props.title || 'Note')}</p><div class="text-sm text-inherit [&>p]:m-0">${await prose(String(attrs.children ?? ''))}</div></div></div></div>`;
    if (entry) return prose(documentSource(node));
    const proposal = await lookupProposal(String(attrs.id));
    if (
      !proposal ||
      proposal.status !== 'approved' ||
      proposal.version !== String(attrs.version)
    )
      return '<p class="fallback">This component needs an approved matching version before it can run.</p>';
    try {
      const sandbox = await compileSandbox(proposal, props);
      return `<figure class="my-6 space-y-3"><iframe class="generated h-96 w-full rounded-lg border border-outline-variant" title="${escape(proposal.name)}" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${escape(sandbox)}"></iframe><figcaption class="space-y-2 text-body-medium leading-relaxed text-on-surface"><p class="whitespace-pre-wrap">${escape(proposal.portableText)}</p></figcaption></figure>`;
    } catch (error) {
      console.error('Studio component preview compilation failed', error);
      return `<p class="fallback">${escape(proposal.name)} could not be previewed. Its saved source is preserved.</p>`;
    }
  }
  return await render(body.document);
}

/** Compatibility document for isolated previews. The native Read view uses body HTML. */
export async function websitePreview(
  ...args: Parameters<typeof websitePreviewBody>
): Promise<string> {
  return (
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    (await websitePreviewBody(...args))
  );
}
