import sanitizeHtml from 'sanitize-html';

import { renderFeedHtml } from '@/lib/indieweb/feeds/html';
import { imageMetadata } from '@/lib/media/geometry';
import { absoluteUrl } from '@/lib/site/urls';
import { escapeHtml } from '@/lib/text/html';

import { catalogEntry } from './catalog';
import { compileSandbox } from './components';
import { documentSource } from './document';
import { studioHtmlPolicy } from './html-policy';
import { effectivePortable } from './portable';
import { getStudioStore } from './store';
import type { ComponentProposal, DraftContent, EditorNode } from './types';

function imageUrl(value: unknown): string {
  const url = String(value ?? '');
  return /^(?:https?:\/\/|\/(?!\/))/i.test(url) ? url : '';
}

/** Renders data-only website blocks. Imported MDX passes through the feed parser,
 * never a JavaScript compiler. Only explicitly approved component source is bundled,
 * and its output runs inside an opaque sandbox with its own network-denying CSP. */
type ProposalLookup = (id: string) => Promise<ComponentProposal | null>;

export async function websitePreviewBody(
  body: DraftContent,
  slug: string,
  lookupProposal: ProposalLookup = (id) => getStudioStore().proposal(id)
): Promise<string> {
  const canonical = absoluteUrl(`/writings/${encodeURIComponent(slug)}`);
  async function prose(source: string) {
    try {
      return sanitizeHtml(
        await renderFeedHtml(source, canonical),
        studioHtmlPolicy
      );
    } catch {
      return `<pre>${escapeHtml(source)}</pre>`;
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
    if (node.type === 'image')
      return figureHtml({ ...attrs, caption: attrs.title });
    if (node.type !== 'catalogBlock') return prose(documentSource(node));
    return renderCatalog(node);
  }
  async function renderCatalog(node: EditorNode): Promise<string> {
    const attrs = node.attrs ?? {};
    const entry = catalogEntry(String(attrs.id), String(attrs.version));
    const props = previewProperties(attrs.props);
    if (entry?.id === 'figure') return figureHtml(props);
    if (entry?.id === 'callout')
      // Match the public Callout note variant, including its decorative mark.
      return `<div class="my-6 rounded-lg border-l-4 p-4 border-primary bg-primary-container text-on-primary-container" role="note"><div class="flex items-start gap-3"><svg xmlns="http://www.w3.org/2000/svg" class="mt-0 h-5 w-5 flex-shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><div class="flex-1"><p class="mb-1 text-sm font-semibold text-primary">${escapeHtml(props.title || 'Note')}</p><div class="text-sm text-inherit [&>p]:m-0">${await prose(String(attrs.children ?? ''))}</div></div></div></div>`;
    if (entry) return prose(documentSource(node));
    return generatedHtml(attrs, props, lookupProposal);
  }
  return await render(body.document);
}

/** Compatibility document for isolated previews. The native Read view uses body HTML. */
export async function websitePreview(
  body: DraftContent,
  slug: string,
  lookupProposal?: ProposalLookup
): Promise<string> {
  return (
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    (await websitePreviewBody(body, slug, lookupProposal))
  );
}

function previewImage(
  src: string,
  alt: unknown,
  width?: unknown,
  height?: unknown
): string {
  const size = imageMetadata(src, width, height);
  const dimensions = size
    ? ` width="${size.width}" height="${size.height}"`
    : '';
  const ratio = size ? `${size.width} / ${size.height}` : '4 / 3';
  return `<img${dimensions} decoding="async" loading="lazy" style="width:100%;height:auto;aspect-ratio:${ratio};object-fit:contain" class="h-auto w-full" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
}

function figureHtml(props: Record<string, unknown>): string {
  const src = imageUrl(props.src);
  return src
    ? `<figure class="my-8"><div class="overflow-hidden rounded-lg">${previewImage(src, props.alt, props.width, props.height)}</div>${props.caption ? `<figcaption class="mt-3 text-center text-body-small text-on-surface-variant">${escapeHtml(props.caption)}</figcaption>` : ''}</figure>`
    : '<p class="fallback">Choose an image to preview this figure.</p>';
}
async function generatedHtml(
  attrs: Record<string, unknown>,
  props: Record<string, unknown>,
  lookupProposal: ProposalLookup
): Promise<string> {
  const proposal = await lookupProposal(String(attrs.id));
  if (
    !proposal ||
    proposal.status !== 'approved' ||
    proposal.version !== String(attrs.version)
  )
    return '<p class="fallback">This component needs an approved matching version before it can run.</p>';
  try {
    const sandbox = await compileSandbox(proposal, props);
    return `<figure class="my-6 space-y-3"><iframe class="generated h-96 w-full rounded-lg border border-outline-variant" title="${escapeHtml(proposal.name)}" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${escapeHtml(sandbox)}"></iframe><figcaption class="space-y-2 text-body-medium leading-relaxed text-on-surface"><p class="whitespace-pre-wrap">${escapeHtml(effectivePortable(attrs, proposal.portableText))}</p></figcaption></figure>`;
  } catch (error) {
    console.error('Studio component preview compilation failed', error);
    return `<p class="fallback">${escapeHtml(proposal.name)} could not be previewed. Its saved source is preserved.</p>`;
  }
}

function previewProperties(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
