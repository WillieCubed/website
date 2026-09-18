import { SITE_NAME, SITE_URL } from '@/lib/indieweb/constants';
import type {
  OEmbedBuildOptions,
  OEmbedHtmlParts,
  OEmbedResponse,
} from '@/lib/indieweb/types';

export function buildOEmbedResponse({
  targetUrl,
  title,
  description,
  thumbnailUrl,
}: OEmbedBuildOptions): OEmbedResponse {
  return {
    version: '1.0',
    type: 'rich',
    provider_name: SITE_NAME,
    provider_url: SITE_URL,
    title,
    author_name: SITE_NAME,
    author_url: SITE_URL,
    html: buildOEmbedHtml({ title, description, url: targetUrl }),
    thumbnail_url: thumbnailUrl,
    thumbnail_width: 1200,
    thumbnail_height: 630,
    cache_age: 86400,
  };
}

function buildOEmbedHtml({ title, description, url }: OEmbedHtmlParts): string {
  const descriptionHtml = description
    ? `<p>${escapeHtml(description)}</p>`
    : '';

  return `<blockquote><p><a href="${escapeHtml(url)}">${escapeHtml(
    title
  )}</a></p>${descriptionHtml}<footer>${SITE_NAME}</footer></blockquote>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
