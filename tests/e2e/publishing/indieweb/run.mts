import { mf2 } from 'microformats-parser';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { dirname } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { type DefaultTreeAdapterMap, parse } from 'parse5';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  discoverAuthor,
  fetchAuthorPage,
  findEntry,
} from '../../../../lib/indieweb/authorship';
import { sanitizeCommentHtml } from '../../../../lib/indieweb/comment-content';
import {
  generateAtomFeed,
  generateRssFeed,
  writingToFeedItem,
} from '../../../../lib/indieweb/feeds/index';
import { discoverWebmentionEndpoint } from '../../../../lib/indieweb/webmention/send';
import { absoluteUrl } from '../../../../lib/site/urls';
import { plainTextHtml } from '../../../../lib/writings/content';
import type { WritingData } from '../../../../lib/writings/types';
import {
  isMain,
  sourceManifests,
} from '../../../support/publishing/runtime.mts';
import { liveMediaProof as liveMediaProofWithContext } from './media.mts';
import { indieWebEntrypoints } from './sources.mts';

export async function runIndieWebAcceptance() {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      'live-media': { type: 'boolean', default: false },
      'cleanup-only': { type: 'boolean', default: false },
      'env-file': { type: 'string', default: '.env.acceptance-indieweb.local' },
      'acceptance-cwd': {
        type: 'string',
        default:
          '/Users/williecubed/.codex/worktrees/publishing-verification/website',
      },
    },
  });

  async function liveMediaProof() {
    return liveMediaProofWithContext({
      get values() {
        return values;
      },
    });
  }

  if (values['live-media'] || values['cleanup-only']) {
    try {
      await liveMediaProof();
    } catch {
      console.error(
        'The isolated media operation failed. Private ownership and proof files remain available for recovery; raw diagnostics were withheld.'
      );
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  }

  const report: {
    startedAt: string;
    finishedAt?: string;
    evidenceKind: string;
    checks: {
      name: string;
      status: 'passed' | 'failed';
      evidence?: unknown;
      error?: string;
    }[];
  } = {
    startedAt: new Date().toISOString(),
    evidenceKind:
      'Live independent fixture fetches and validation of current component/feed output. No post, PDS record, Webmention, token, or stored media is created.',
    checks: [],
  };

  async function check(name: string, run: () => Promise<unknown>) {
    try {
      const evidence = await run();
      report.checks.push({ name, status: 'passed', evidence });
      console.log(`PASS ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.checks.push({ name, status: 'failed', error: message });
      console.error(`FAIL ${name}: ${message}`);
    }
  }

  const authors = [
    { name: 'William Shakespeare' },
    {
      name: 'Homer',
      url: 'https://en.wikiquote.org/wiki/Homer',
      photo: 'https://authorship.rocks/images/homer.jpg',
    },
    {
      name: 'Patañjali',
      url: 'https://authorship.rocks/test/3/about-patanjali',
    },
    {
      name: 'Virginia Woolf',
      url: 'https://authorship.rocks/test/4/about-virginia-woolf',
      photo: 'https://authorship.rocks/images/virginia-woolf.jpg',
    },
    {
      name: 'Basho',
      url: 'https://authorship.rocks/test/5/about-basho',
      photo: 'https://authorship.rocks/images/basho.jpg',
    },
  ];

  for (const [index, expected] of authors.entries()) {
    await check(`Authorship Rocks ${index + 1}`, async () => {
      const url = `https://authorship.rocks/test/${index + 1}`;
      const page = await fetchAuthorPage(url);
      assert.ok(
        page,
        'The actual public-address fetch guard could not retrieve the fixture.'
      );
      const document = mf2(page.html, { baseUrl: page.url });
      const entry = findEntry(document.items);
      assert.ok(entry, 'The independent fixture contains no h-entry.');
      const actual = await discoverAuthor(document, entry, page.url);
      assert.deepEqual(actual, expected);
      return { url, actual };
    });
  }

  for (let index = 1; index <= 23; index++) {
    await check(`Webmention Rocks discovery ${index}`, async () => {
      const url = `https://webmention.rocks/test/${index}${index === 23 ? '/page' : ''}`;
      const endpoint = await discoverWebmentionEndpoint(url);
      assert.ok(endpoint, 'No endpoint was discovered from the live fixture.');
      const parsed = new URL(endpoint);
      assert.equal(parsed.origin, 'https://webmention.rocks');
      if (index === 15) assert.equal(parsed.pathname, '/test/15');
      else if (index === 23)
        assert.match(
          parsed.pathname,
          /^\/test\/23\/page\/webmention-endpoint\/[A-Za-z0-9]+$/
        );
      else assert.equal(parsed.pathname, `/test/${index}/webmention`);
      if ([1, 2, 7, 8, 10, 18, 19].includes(index))
        assert.equal(parsed.search, '?head=true');
      if (index === 21) assert.equal(parsed.search, '?query=yes');
      return {
        url,
        endpoint,
        proves: 'Endpoint discovery only. No mention is sent.',
      };
    });
  }

  // Next bundles these styles; Node needs only the components' HTML for the independent parsers.
  registerHooks({
    load(url, context, nextLoad) {
      return url.endsWith('.css')
        ? { format: 'module', source: '', shortCircuit: true }
        : nextLoad(url, context);
    },
  });

  const { default: WritingItem } =
    await import('../../../../components/writings/WritingItem');

  const writing: WritingData = {
    slug: 'local-component-validation',
    title: 'مرحبا Alice',
    description: 'שלום Alice',
    hasExplicitTitle: true,
    published: new Date('2026-10-07T12:00:00Z'),
    lastUpdated: new Date('2026-10-07T12:00:00Z'),
    tags: ['event'],
    people: [],
    draft: false,
    featured: false,
    readingTime: 2,
    postType: 'event',
    photos: [{ url: 'https://media.example/image.jpg', alt: 'A garden' }],
    audio: ['https://media.example/sound.mp3'],
    video: ['https://media.example/video.mp4'],
    event: {
      start: '2026-11-01T12:00:00Z',
      end: '2026-11-01T13:00:00Z',
      location: 'A garden',
    },
    rsvp: { eventUrl: 'https://event.example/', status: 'yes' },
    micropub: {
      type: ['h-entry'],
      properties: {
        'in-reply-to': ['https://event.example/', 'https://event.example/two'],
        attachment: ['https://media.example/file.pdf'],
      },
    },
  };

  const body =
    '<div dir="auto">' +
    sanitizeCommentHtml(
      '<p dir="rtl">مرحبا <bdi dir="ltr">Alice</bdi></p><bdo dir="rtl">ABC</bdo>',
      absoluteUrl('/writings/local-component-validation')
    ) +
    '</div>';

  const html = renderToStaticMarkup(
    createElement(
      'main',
      { className: 'h-feed' },
      createElement(WritingItem, { writing, contentHtml: body })
    )
  );

  function text(node: DefaultTreeAdapterMap['node']): string {
    return node.nodeName === '#text' && 'value' in node
      ? node.value
      : 'childNodes' in node
        ? node.childNodes.map(text).join('')
        : '';
  }

  function textarea(html: string): string {
    const visit = (node: DefaultTreeAdapterMap['node']): string | undefined => {
      if (
        'tagName' in node &&
        node.tagName === 'textarea' &&
        node.attrs.some(
          (a) => ['json', 'json-input'].includes(a.value) && a.name === 'id'
        )
      )
        return text(node);
      if ('childNodes' in node)
        for (const child of node.childNodes) {
          const found = visit(child);
          if (found !== undefined) return found;
        }
    };
    const found = visit(parse(html));
    assert.ok(
      found,
      'The independent parser did not return its JSON textarea.'
    );
    return found;
  }

  for (const parser of ['go', 'php']) {
    await check(`Independent ${parser} Microformats parser`, async () => {
      const params = new URLSearchParams({
        html,
        [parser === 'go' ? 'base-url' : 'url']: absoluteUrl('/writings'),
      });
      const response = await fetch(`https://${parser}.microformats.io/`, {
        method: 'POST',
        body: params,
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(response.status, 200);
      const parsed = JSON.parse(textarea(await response.text()));
      const entry = parsed.items[0]?.children?.[0];
      assert.ok(
        entry?.type.includes('h-entry') && entry.type.includes('h-event')
      );
      const p = entry.properties;
      assert.deepEqual(p.name, [writing.title]);
      assert.deepEqual(p.summary, [writing.description]);
      assert.deepEqual(p.rsvp, ['yes']);
      assert.deepEqual(p.audio, writing.audio);
      assert.deepEqual(p.video, writing.video);
      assert.deepEqual(p.attachment, ['https://media.example/file.pdf']);
      assert.equal(p['in-reply-to'].length, 2);
      assert.deepEqual(p.start, [writing.event!.start]);
      assert.deepEqual(p.end, [writing.event!.end]);
      assert.deepEqual(p.location, ['A garden']);
      assert.match(p.content[0].html, /dir="rtl"/);
      assert.match(p.content[0].html, /<bdi dir="ltr">Alice<\/bdi>/);
      return {
        service: `https://${parser}.microformats.io/`,
        entry,
        inputKind:
          'Current WritingItem rendered from a local in-memory fixture. No public writing.',
      };
    });
  }

  const item = writingToFeedItem(
    writing,
    body + plainTextHtml('\u200fAlice שלום')
  );

  for (const [format, xml] of [
    ['rss', generateRssFeed([item])],
    ['atom', generateAtomFeed([item])],
  ] as const) {
    await check(`W3C ${format} feed validator`, async () => {
      const response = await fetch('https://validator.w3.org/feed/check.cgi', {
        method: 'POST',
        body: new URLSearchParams({
          rawdata: xml,
          manual: '1',
          output: 'soap12',
        }),
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(response.status, 200);
      const result = await response.text();
      assert.match(result, /<(?:m:)?validity>true<\/(?:m:)?validity>/);
      return {
        service: 'https://validator.w3.org/feed/check.cgi',
        inputKind:
          'Current feed serializer output from an in-memory fixture, not a deployed feed.',
        errorCount: Number(
          /<m:errorcount>(\d+)<\/m:errorcount>/.exec(result)?.[1]
        ),
        warningCount: Number(
          /<m:warningcount>(\d+)<\/m:warningcount>/.exec(result)?.[1]
        ),
        warningContext:
          'Direct input has no document location for its self link. The validator also warns about the valid bdo direction override retained for Micropub rendering.',
        response: result,
      };
    });
    await setTimeout(1100);
  }

  report.finishedAt = new Date().toISOString();

  const json =
    JSON.stringify(
      {
        ...report,
        verifierSourceFiles: await sourceManifests(indieWebEntrypoints),
      },
      null,
      2
    ) + '\n';

  if (values.output) {
    await mkdir(dirname(values.output), { recursive: true });
    await writeFile(values.output, json);
  } else console.log(json);

  if (report.checks.some((check) => check.status === 'failed'))
    process.exitCode = 1;
}

if (isMain(import.meta.url)) await runIndieWebAcceptance();
