import { type Browser, type Page, chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

interface Manifest {
  itemUrl: string;
  title: string;
  published: string;
  updated?: string;
  author: { name: string; url: string };
  attachments: { url: string; mimeType: string }[];
}

async function main() {
  const { values } = parseArgs({
    options: { manifest: { type: 'string' }, output: { type: 'string' } },
  });
  assert(values.manifest && values.output);
  const manifest: Manifest = JSON.parse(
    await readFile(values.manifest, 'utf8')
  );
  const item = new URL(manifest.itemUrl);
  assert.equal(item.origin, 'https://indieweb-acceptance.vercel.app');
  assert(/^\/writings\/indieweb-media-proof-[a-f0-9]{24}$/.test(item.pathname));
  const output = resolve(values.output);
  const inside = relative(resolve('.playwright-mcp'), output);
  assert(inside && !inside.startsWith('..') && !inside.startsWith('/'));
  const directory = dirname(output);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const media = (prefix: string) => {
    const matches = manifest.attachments.filter((entry) =>
      entry.mimeType.startsWith(prefix)
    );
    assert.equal(matches.length, 1);
    const url = new URL(matches[0].url);
    assert.equal(url.protocol, 'https:');
    assert.equal(
      url.hostname,
      'b0dgluyotqkpvpbg.public.blob.vercel-storage.com'
    );
    return url.href;
  };
  const imageUrl = media('image/');
  const audioUrl = media('audio/');
  const videoUrl = media('video/');
  const pdfUrl = media('application/pdf');
  const results: Record<string, unknown>[] = [];
  const feeds: Record<string, unknown>[] = [];
  const receipt = {
    observedAt: new Date().toISOString(),
    canonicalUrl: item.href,
    result: 'pending' as 'pending' | 'passed' | 'failed',
    results,
    feeds,
    error: undefined as string | undefined,
    stack: undefined as string | undefined,
    activeCheck: undefined as string | undefined,
    diagnostic: undefined as string | undefined,
    writes: 'Browser playback and local receipts only.',
  };
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
  const save = () =>
    writeFile(output, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const parser = await browser.newPage();
    try {
      for (const [kind, path] of [
        ['rss', '/writings/feed.xml'],
        ['atom', '/writings/feed/atom'],
      ]) {
        const feedUrl: string = item.origin + path;
        const response: Response = await fetch(feedUrl, {
          signal: AbortSignal.timeout(15000),
        });
        assert.equal(response.status, 200);
        const xml = await response.text();
        const observed = await parser.evaluate(
          ({ xml, kind, target }) => {
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            if (doc.getElementsByTagName('parsererror').length)
              throw new Error('The deployed XML feed is malformed.');
            const entries = Array.from(
              doc.getElementsByTagName(kind === 'rss' ? 'item' : 'entry')
            );
            const matches = entries.filter((entry) =>
              kind === 'rss'
                ? entry.getElementsByTagName('link')[0]?.textContent === target
                : Array.from(entry.getElementsByTagName('link')).some(
                    (link) =>
                      link.getAttribute('rel') === 'alternate' &&
                      link.getAttribute('href') === target
                  )
            );
            if (matches.length !== 1)
              throw new Error('The feed must have one canonical media item.');
            const entry = matches[0];
            return {
              title: entry.getElementsByTagName('title')[0]?.textContent,
              id: entry.getElementsByTagName(kind === 'rss' ? 'guid' : 'id')[0]
                ?.textContent,
              published: entry.getElementsByTagName(
                kind === 'rss' ? 'pubDate' : 'published'
              )[0]?.textContent,
              updated:
                kind === 'atom'
                  ? entry.getElementsByTagName('updated')[0]?.textContent
                  : undefined,
              author:
                kind === 'rss'
                  ? entry.getElementsByTagNameNS(
                      'http://purl.org/dc/elements/1.1/',
                      'creator'
                    )[0]?.textContent
                  : entry
                      .getElementsByTagName('author')[0]
                      ?.getElementsByTagName('name')[0]?.textContent,
              authorUrl:
                kind === 'atom'
                  ? entry
                      .getElementsByTagName('author')[0]
                      ?.getElementsByTagName('uri')[0]?.textContent
                  : undefined,
              content:
                kind === 'rss'
                  ? entry.getElementsByTagNameNS(
                      'http://purl.org/rss/1.0/modules/content/',
                      'encoded'
                    )[0]?.textContent
                  : entry.getElementsByTagName('content')[0]?.textContent,
              enclosures:
                kind === 'rss'
                  ? Array.from(entry.getElementsByTagName('enclosure')).map(
                      (link) => ({
                        url: link.getAttribute('url'),
                        mimeType: link.getAttribute('type'),
                        length: link.getAttribute('length'),
                      })
                    )
                  : Array.from(entry.getElementsByTagName('link'))
                      .filter(
                        (link) => link.getAttribute('rel') === 'enclosure'
                      )
                      .map((link) => ({
                        url: link.getAttribute('href'),
                        mimeType: link.getAttribute('type'),
                        length: link.getAttribute('length'),
                      })),
            };
          },
          { xml, kind, target: item.href }
        );
        assert.equal(observed.title, manifest.title);
        assert.equal(observed.id, item.href);
        if (kind === 'rss') {
          assert.equal(
            Math.floor(new Date(observed.published!).getTime() / 1000),
            Math.floor(new Date(manifest.published).getTime() / 1000)
          );
        } else {
          assert.equal(
            new Date(observed.published!).toISOString(),
            manifest.published
          );
        }
        assert.equal(observed.author, manifest.author.name);
        if (kind === 'atom') {
          assert.equal(
            new Date(observed.updated!).toISOString(),
            manifest.updated ?? manifest.published
          );
          assert.equal(observed.authorUrl, manifest.author.url);
          const expected = manifest.attachments.filter(
            (entry) => !entry.mimeType.startsWith('image/')
          );
          assert.equal(observed.enclosures.length, expected.length);
          for (const attachment of expected) {
            const matching = observed.enclosures.filter(
              (entry) => entry.url === attachment.url
            );
            assert.equal(matching.length, 1);
            assert.equal(matching[0].mimeType, attachment.mimeType);
            assert(Number(matching[0].length) > 0);
          }
        } else {
          assert.equal(observed.enclosures.length, 1);
          assert.equal(observed.enclosures[0].url, audioUrl);
          assert.equal(
            observed.enclosures[0].mimeType,
            manifest.attachments.find((entry) => entry.url === audioUrl)!
              .mimeType
          );
          assert(Number(observed.enclosures[0].length) > 0);
        }
        for (const attachment of manifest.attachments)
          assert(observed.content?.includes(attachment.url));
        feeds.push({ kind, feedUrl, ...observed });
        await save();
      }
    } finally {
      await parser.close();
    }
    for (const width of [1440, 390]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          reducedMotion: 'reduce',
          colorScheme: theme === 'light' ? 'light' : 'dark',
        });
        let page: Page | undefined;
        try {
          receipt.activeCheck = `${width}px ${theme}: page and theme`;
          await context.addInitScript(
            (theme) => localStorage.setItem('theme', theme),
            theme
          );
          page = await context.newPage();
          const response = await page.goto(item.href, {
            waitUntil: 'networkidle',
            timeout: 45000,
          });
          assert.equal(response?.status(), 200);
          assert.equal(
            await page.locator('html').getAttribute('data-theme'),
            theme
          );
          await page
            .getByRole('heading', { name: manifest.title, exact: true })
            .waitFor();
          receipt.activeCheck = `${width}px ${theme}: authored image decoding`;
          const image = page.locator('article img').filter({ visible: true });
          const authoredImage = page.locator(`article img[src="${imageUrl}"]`);
          assert.equal(await authoredImage.count(), 1);
          await authoredImage.scrollIntoViewIfNeeded();
          await authoredImage.evaluate(async (element) => {
            await (element as HTMLImageElement).decode();
          });
          assert.equal(
            await authoredImage.getAttribute('alt'),
            'The authored inline image'
          );
          assert(
            (await image.count()) >= 1,
            'The authored image must be visible.'
          );
          const playback = [];
          for (const [tag, url] of [
            ['audio', audioUrl],
            ['video', videoUrl],
          ]) {
            receipt.activeCheck = `${width}px ${theme}: native ${tag} playback`;
            const selector = `article ${tag}[src="${url}"], article ${tag}:has(source[src="${url}"])`;
            const element = page.locator(selector);
            assert.equal(await element.count(), 1);
            await element.scrollIntoViewIfNeeded();
            await element.click();
            const observed = await element.evaluate(async (node) => {
              const media = node as HTMLMediaElement;
              if (!media.controls || media.autoplay)
                throw new Error('Invalid native media controls.');
              await media.play();
              await new Promise<void>((finish, reject) => {
                const deadline = setTimeout(() => {
                  clearInterval(poll);
                  reject(new Error('Native media did not advance.'));
                }, 15000);
                const poll = setInterval(() => {
                  if (
                    media.currentTime > 0 &&
                    Number.isFinite(media.duration) &&
                    media.duration > 0
                  ) {
                    clearInterval(poll);
                    clearTimeout(deadline);
                    finish();
                  }
                }, 100);
              });
              const observed = {
                controls: media.controls,
                autoplay: media.autoplay,
                duration: media.duration,
                advancedTo: media.currentTime,
                ...(node instanceof HTMLVideoElement && {
                  width: node.videoWidth,
                  height: node.videoHeight,
                }),
              };
              media.pause();
              media.currentTime = 0;
              return observed;
            });
            if (tag === 'video')
              assert(
                observed.width && observed.height,
                'The playing video must have decoded dimensions.'
              );
            playback.push({ kind: tag, ...observed });
          }
          receipt.activeCheck = `${width}px ${theme}: PDF attachment`;
          const pdf = page.locator(`article a.u-attachment[href="${pdfUrl}"]`);
          assert.equal(await pdf.count(), 1);
          assert(
            await pdf.isVisible(),
            'The PDF attachment button must be visible.'
          );
          receipt.activeCheck = `${width}px ${theme}: viewport containment`;
          assert(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <= window.innerWidth + 1
            ),
            'The authored media page overflows its viewport.'
          );
          await page.evaluate(() => window.scrollTo(0, 0));
          const screenshot = resolve(
            directory,
            `authored-media-${width}-${theme}.png`
          );
          await page.screenshot({ path: screenshot, fullPage: true });
          await chmod(screenshot, 0o600);
          results.push({
            width,
            theme,
            nativePlayback: playback,
            oneImage: true,
            onePdfAttachment: true,
            viewportContained: true,
            screenshot,
          });
          await save();
        } catch (error) {
          if (page && !page.isClosed()) {
            const diagnostic = resolve(
              directory,
              `authored-media-diagnostic-${width}-${theme}.png`
            );
            await page
              .screenshot({ path: diagnostic, fullPage: true })
              .then(async () => {
                await chmod(diagnostic, 0o600);
                receipt.diagnostic = diagnostic;
              })
              .catch(() => undefined);
          }
          throw error;
        } finally {
          await context.close();
        }
      }
    }
    receipt.result = 'passed';
    await save();
  } catch (error) {
    receipt.result = 'failed';
    receipt.error =
      error instanceof Error
        ? error.message
        : 'Unknown browser verification failure.';
    receipt.stack = error instanceof Error ? error.stack : undefined;
    await save();
    throw error;
  } finally {
    await browser?.close();
  }
  console.log('Native media playback and four full-page renders passed.');
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Native media verification failed.'
  );
  process.exitCode = 1;
});
