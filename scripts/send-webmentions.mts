#!/usr/bin/env node
/**
 * Post-build script to send webmentions for new/updated posts.
 *
 * Run after `next build`:
 *   pnpm webmentions:send
 *
 * The postbuild script runs it when INDIEWEB_POSTBUILD=1.
 *
 * Environment variables:
 *   POSTGRES_URL - Required for database access
 *   SKIP_WEBMENTIONS - Set to "true" to skip (useful for preview deploys)
 */
import { createHash } from 'node:crypto';

import { absoluteUrl, site } from '../lib/site';

const SITE_URL = site.origin;
const SITE_HOST = new URL(SITE_URL).hostname;
const USER_AGENT = `${SITE_HOST} webmention sender`;
const FETCH_TIMEOUT = 10000;

// Skip in preview deployments or when explicitly disabled
if (process.env.SKIP_WEBMENTIONS === 'true') {
  console.log('⏭️  Skipping webmentions (SKIP_WEBMENTIONS=true)');
  process.exit(0);
}

if (process.env.VERCEL_ENV === 'preview') {
  console.log('⏭️  Skipping webmentions (preview deployment)');
  process.exit(0);
}

// Check for database connection
if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  console.log('⏭️  Skipping webmentions (no database configured)');
  process.exit(0);
}

// Imported after the guards so a build with no database never loads the driver.
const { sql } = await import('@vercel/postgres');

interface SendResult {
  targetUrl: string;
  success: boolean;
  endpoint?: string;
  error?: string;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Discover webmention endpoint for a URL.
 */
async function discoverEndpoint(targetUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timeoutId);

    // Check Link header
    const linkHeader = response.headers.get('Link');
    if (linkHeader) {
      const match = linkHeader.match(/<([^>]+)>.*rel=["']?webmention["']?/i);
      if (match) return new URL(match[1], targetUrl).href;
    }

    // Fetch HTML and check for <link>
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT);
    const htmlResponse = await fetch(targetUrl, {
      signal: controller2.signal,
      headers: {
        Accept: 'text/html',
        'User-Agent': USER_AGENT,
      },
    });
    clearTimeout(timeoutId2);

    if (!htmlResponse.ok) return null;

    const html = await htmlResponse.text();
    const linkMatch =
      html.match(
        /<link[^>]*rel=["']?webmention["']?[^>]*href=["']([^"']+)["']/i
      ) ||
      html.match(
        /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']?webmention["']?/i
      );

    if (linkMatch) return new URL(linkMatch[1], targetUrl).href;

    return null;
  } catch {
    return null;
  }
}

/**
 * Send a webmention to a target.
 */
async function sendWebmention(
  sourceUrl: string,
  targetUrl: string
): Promise<SendResult> {
  const endpoint = await discoverEndpoint(targetUrl);

  if (!endpoint) {
    return { targetUrl, success: false, error: 'No endpoint' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({ source: sourceUrl, target: targetUrl }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return {
      targetUrl,
      success: response.ok || response.status === 202,
      endpoint,
    };
  } catch (error) {
    return {
      targetUrl,
      success: false,
      endpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function isOwnHost(hostname: string): boolean {
  return (
    hostname === SITE_HOST ||
    (site.legacyHosts as readonly string[]).includes(hostname) ||
    hostname in site.aliasHosts
  );
}

/**
 * Extract external links from markdown/HTML content.
 */
function extractExternalLinks(content: string): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const mdLinkRegex = /\]\(([^)]+)\)/g;
  const links = new Set<string>();

  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    try {
      const url = new URL(match[1]);
      if (url.protocol === 'https:' && !isOwnHost(url.hostname)) {
        links.add(match[1]);
      }
    } catch {
      /* skip invalid URLs */
    }
  }

  while ((match = mdLinkRegex.exec(content)) !== null) {
    try {
      const url = new URL(match[1]);
      if (url.protocol === 'https:' && !isOwnHost(url.hostname)) {
        links.add(match[1]);
      }
    } catch {
      /* skip invalid URLs */
    }
  }

  return [...links];
}

async function main() {
  console.log('📤 Sending webmentions for updated posts...\n');

  // loadWriting skips the Next.js cache layer, which throws outside next.
  const { getWritingSlugs, loadWriting } = await import('../lib/writings');

  const slugs = await getWritingSlugs();
  const loaded = await Promise.all(slugs.map((slug) => loadWriting(slug)));
  const published = loaded.filter(({ writing }) => !writing.draft);
  let totalSent = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const { writing, content } of published) {
    const sourceUrl = absoluteUrl(`/writings/${writing.slug}`);
    // Person tags live in frontmatter, outside `content`, so they join the
    // hash to resend when one is added. Posts without any keep their hash.
    const peopleUrls = writing.people.map((person) => person.url);
    const contentHash = hashContent(
      peopleUrls.length > 0 ? [content, ...peopleUrls].join('\n') : content
    );

    // Check if content has changed
    const existing = await sql`
      SELECT content_hash FROM outgoing_webmentions
      WHERE post_slug = ${writing.slug}
      LIMIT 1
    `;

    if (existing.rows[0]?.content_hash === contentHash) {
      totalSkipped++;
      continue;
    }

    // Collect all target URLs
    const contentLinks = extractExternalLinks(content);
    const interactionUrls: string[] = [];
    if (writing.likeOf) interactionUrls.push(writing.likeOf);
    if (writing.repostOf) interactionUrls.push(writing.repostOf);
    if (writing.bookmarkOf) interactionUrls.push(writing.bookmarkOf);
    if (writing.inReplyTo) interactionUrls.push(writing.inReplyTo);
    if (writing.rsvp?.eventUrl) interactionUrls.push(writing.rsvp.eventUrl);

    const targets = [
      ...new Set([...contentLinks, ...interactionUrls, ...peopleUrls]),
    ];

    if (targets.length === 0) {
      totalSkipped++;
      continue;
    }

    console.log(`📝 ${writing.slug} (${targets.length} targets)`);

    for (const targetUrl of targets) {
      const result = await sendWebmention(sourceUrl, targetUrl);

      // Track in database
      const status = result.success
        ? 'sent'
        : result.error === 'No endpoint'
          ? 'no_endpoint'
          : 'failed';
      await sql`
        INSERT INTO outgoing_webmentions (source_url, target_url, post_slug, content_hash, status, sent_at)
        VALUES (${sourceUrl}, ${targetUrl}, ${writing.slug}, ${contentHash}, ${status}, ${result.success ? new Date().toISOString() : null})
        ON CONFLICT (source_url, target_url) DO UPDATE SET
          content_hash = EXCLUDED.content_hash,
          status = EXCLUDED.status,
          sent_at = CASE WHEN EXCLUDED.status = 'sent' THEN NOW() ELSE outgoing_webmentions.sent_at END
      `;

      if (result.success) {
        console.log(`   ✅ ${new URL(targetUrl).hostname}`);
        totalSent++;
      } else if (result.error === 'No endpoint') {
        console.log(`   ⏭️  ${new URL(targetUrl).hostname} (no endpoint)`);
      } else {
        console.log(`   ❌ ${new URL(targetUrl).hostname}: ${result.error}`);
        totalFailed++;
      }

      // Be polite
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(
    `\n✨ Done: ${totalSent} sent, ${totalSkipped} unchanged, ${totalFailed} failed`
  );
}

main().catch((error) => {
  console.error('❌ Webmention sending failed:', error);
  // Don't fail the build for webmention errors
  process.exit(0);
});
