/* global document, innerWidth, scrollTo */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { isMain } from '../../../support/publishing/runtime.mts';

export async function captureMusicPrototype() {
  const output =
    process.argv[2] ??
    `.playwright-mcp/music/iterations/${new Date().toISOString().replaceAll(':', '-')}`;
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const records: {
    device: string;
    name: string;
    colorScheme: 'light' | 'dark';
    width: number;
    height: number;
    file: string;
  }[] = [];
  try {
    for (const [device, width, height] of [
      ['desktop', 1440, 1000],
      ['mobile', 390, 844],
    ] as const) {
      for (const colorScheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({
          viewport: { width, height },
          colorScheme,
          reducedMotion: 'reduce',
          isMobile: device === 'mobile',
          hasTouch: device === 'mobile',
        });
        const page = await context.newPage();
        page.on('pageerror', (error) => {
          throw error;
        });
        await page.goto('http://127.0.0.1:3137/prototypes/music', {
          waitUntil: 'domcontentloaded',
        });
        await page
          .locator('.music-prototype[aria-busy="false"]')
          .waitFor({ timeout: 60000 });
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: 'nextjs-portal {display:none}' });
        const capture = async (name: string) => {
          const file = `${output}/${device}-${name}-${colorScheme}.png`;
          await page.screenshot({ path: file, fullPage: false });
          if (!(await page.locator('dialog[open]').count()))
            await page.screenshot({
              path: `${output}/${device}-${name}-${colorScheme}-full.png`,
              fullPage: true,
            });
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth
          );
          if (overflow) throw new Error(`${device} ${name} overflows`);
          records.push({ device, name, colorScheme, width, height, file });
        };
        await capture('gallery');
        if (process.argv[3] === '--setup') {
          await page
            .getByRole('button', { name: 'Show setup', exact: true })
            .click();
          await capture('setup-connect');
          await page
            .getByRole('button', { name: 'Connect Spotify', exact: true })
            .click();
          for (const name of [
            'Fall Tour 2026, Part 1',
            'Summer 2026',
            'Late hours',
          ]) {
            await page
              .getByRole('checkbox', { name: `Select ${name}`, exact: true })
              .check();
          }
          await page.evaluate(() => scrollTo(0, 0));
          await capture('setup-choose');
          await page
            .getByRole('button', { name: 'Preview collection', exact: true })
            .click();
          await page
            .getByRole('radio', {
              name: 'Feature Fall Tour 2026, Part 1',
              exact: true,
            })
            .check();
          await page.evaluate(() => scrollTo(0, 0));
          await capture('setup-preview');
          const noFeature = page.getByRole('radio', {
            name: 'No featured playlist',
            exact: true,
          });
          await noFeature.scrollIntoViewIfNeeded();
          await noFeature.focus();
          await page.keyboard.press('ArrowDown');
          await capture('setup-preview-options');
          await page.keyboard.press('ArrowUp');
          await capture('setup-no-feature');
          await context.close();
          continue;
        }
        await page
          .getByRole('button', { name: 'Curate music', exact: true })
          .click();
        await capture('library');
        await page
          .getByRole('group', { name: 'Library filter' })
          .getByRole('button', { name: 'Not included', exact: true })
          .click();
        await capture('excluded');
        await page
          .getByRole('group', { name: 'Library filter' })
          .getByRole('button', { name: 'All', exact: true })
          .click();
        await page
          .getByRole('button', {
            name: 'Open Fall Tour 2026, Part 1',
            exact: true,
          })
          .click();
        await capture('editor');
        await page.locator('.mp-detail-scroll').evaluate((el) => {
          el.scrollTop = 360;
        });
        await capture('editor-lower');
        await page
          .getByRole('button', { name: 'Close playlist', exact: true })
          .click();
        await page
          .getByRole('textbox', { name: 'Find a playlist', exact: true })
          .fill('No such playlist');
        await capture('search-empty');
        await page
          .getByRole('textbox', { name: 'Find a playlist', exact: true })
          .fill('');
        await page
          .getByRole('checkbox', { name: 'Include Loose ends', exact: true })
          .check();
        await page
          .getByRole('button', { name: 'Review changes', exact: true })
          .click();
        await capture('review');
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(`${output}/manifest.json`, JSON.stringify(records, null, 2));
  console.log(
    `Captured ${records.length} full-viewport screenshots in ${output}`
  );
}

if (isMain(import.meta.url)) await captureMusicPrototype();
