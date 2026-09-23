import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { site } from '@/lib/site';
import { themeSchemes } from '@/lib/theme';

const publicDir = path.join(process.cwd(), 'public');

async function webManifest() {
  const { default: manifest } = await import('@/app/manifest');
  return manifest();
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false
  );
}

test('the manifest takes its colors from the theme surface', async () => {
  const manifest = await webManifest();

  assert.equal(manifest.theme_color, themeSchemes.light.surface);
  assert.equal(manifest.theme_color, site.themeColor);
  assert.equal(manifest.background_color, site.themeColors.light);
});

test('the manifest names the site without app-store categories', async () => {
  const manifest = await webManifest();

  assert.equal(manifest.name, site.name);
  assert.equal(manifest.short_name, site.shortName);
  assert.equal(manifest.lang, 'en-US');
  assert.equal(manifest.categories, undefined);
});

test('every manifest icon is a file in public/', async () => {
  const { icons = [] } = await webManifest();

  assert.ok(icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of icons) {
    assert.ok(
      await exists(path.join(publicDir, icon.src)),
      `${icon.src} is missing`
    );
  }
});

test('the site serves one manifest, generated rather than copied', async () => {
  assert.ok(!(await exists(path.join(publicDir, 'manifest.webmanifest'))));
});
