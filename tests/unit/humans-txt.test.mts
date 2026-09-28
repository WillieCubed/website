import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { HUMANS_COMPONENTS, buildHumansTxt } from '@/lib/humans-txt';
import { site } from '@/lib/site';

test('humans.txt names the team: Willie, the site, and the contact address', () => {
  const text = buildHumansTxt();

  assert.match(text, /^\/\* TEAM \*\/$/m);
  assert.match(text, new RegExp(`^Developer: ${site.author.name}$`, 'm'));
  assert.match(text, new RegExp(`^Site: ${site.origin}$`, 'm'));
  assert.match(text, new RegExp(`^Contact: ${site.emails.hello}$`, 'm'));
});

test('the last update is the build day in the site time zone', () => {
  // 03:00 UTC on the 28th is still the evening of the 27th in Las Vegas.
  const text = buildHumansTxt(new Date('2026-09-28T03:00:00Z'));

  assert.match(text, /^\/\* SITE \*\/$/m);
  assert.match(text, /^Last update: 2026\/09\/27$/m);
});

test('without a build time the last update line is left out', () => {
  assert.doesNotMatch(buildHumansTxt(), /Last update/);
});

test('every listed component is a dependency in package.json', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const installed = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const [name, label] of HUMANS_COMPONENTS) {
    assert.ok(name in installed, `${label} (${name}) is not in package.json`);
  }
  assert.match(
    buildHumansTxt(),
    /^Components: Next\.js, React, Tailwind CSS, .+$/m
  );
});

test('/humans.txt answers as plain text', async () => {
  const { GET } = await import('@/app/humans.txt/route');
  const response = GET();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('Content-Type'),
    'text/plain; charset=utf-8'
  );
  assert.match(await response.text(), /^\/\* TEAM \*\//);
});
