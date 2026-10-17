import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type {
  Draft,
  EditorNode,
  Generation,
  Publication,
} from '@/lib/studio/types';

test.skip(
  process.env.STUDIO_E2E !== '1',
  'Requires the isolated signed-JWT local studio harness.'
);
async function createWriting(
  request: import('@playwright/test').APIRequestContext,
  title: string
) {
  const response = await request.post('/api/studio/documents', {
    headers: { Origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      slug: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      body: {
        title,
        description: 'A thought for this test.',
        postType: 'article',
        tags: ['Thoughts'],
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'This private writing belongs here.' },
              ],
            },
          ],
        },
      },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function settledScreenshot(
  page: import('@playwright/test').Page,
  options: Parameters<import('@playwright/test').Page['screenshot']>[0]
) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => {}))
    );
  });
  return page.screenshot(options);
}
async function writingAction(
  page: import('@playwright/test').Page,
  name: string
) {
  if (name === 'Writing details') {
    await page
      .getByRole('button', { name: 'Writing details', exact: true })
      .click();
    return;
  }
  if (
    name === 'Create widget' &&
    !(await page
      .getByRole('button', { name: 'Insert block', exact: true })
      .isVisible())
  )
    // Reveal the insertion control without replacing the selected prose with a caret.
    await page.getByRole('textbox', { name: 'Writing content' }).focus();
  await page
    .getByRole('button', {
      name: name === 'Create widget' ? 'Insert block' : 'Writing actions',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: name === 'Create widget' ? 'Create widget…' : name,
      exact: true,
    })
    .click();
}
test('a short press visibly changes a rounded action before release', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/studio');
  const action = page.getByRole('button', { name: 'New writing', exact: true });
  await expect(action).toBeEnabled();
  const box = (await action.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(56);
  await action.hover();
  await page.mouse.down();
  try {
    const sample = await action.evaluate(async (element) => {
      await new Promise(requestAnimationFrame);
      const shapes = element
        .getAnimations()
        .filter(
          (animation) =>
            animation instanceof CSSTransition &&
            animation.transitionProperty.includes('radius')
        );
      for (const shape of shapes) {
        shape.pause();
        shape.currentTime = 60;
      }
      return {
        count: shapes.length,
        radius: parseFloat(getComputedStyle(element).borderTopLeftRadius),
      };
    });
    expect(sample.count).toBeGreaterThan(0);
    // An oversized pill radius stays visually clamped to a semicircle during
    // a short tap, despite the computed radius already interpolating.
    expect(sample.radius).toBeLessThan(box.height / 2);
    expect(await action.boundingBox()).toEqual(box);
  } finally {
    await action.evaluate((element) =>
      element.getAnimations().forEach((animation) => animation.play())
    );
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
});

test('the writing workspace keeps its tonal surfaces and editing controls', async ({
  page,
  request,
}, testInfo) => {
  const draft = await createWriting(request, 'A working draft');
  await page.goto(`/studio/${draft.id}`);
  const canvas = page.getByRole('region', { name: 'Writing editor' });
  const editor = canvas.getByRole('textbox', { name: 'Writing content' });
  await expect(editor).toContainText('This private writing belongs here.');
  await expect(page.locator('.studio-document-opening')).toHaveCount(0);
  await expect(
    page.locator('.studio-document-reveal[data-ready] .studio-heading-fields')
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Writing controls' })
  ).toBeVisible();
  const surfaces = await page.evaluate(() => {
    const root = document.documentElement;
    const ready = document.querySelector(
      '.studio-document-reveal[data-ready]'
    )!;
    const heading = ready.querySelector('.studio-heading-fields')!;
    const canvas = ready.querySelector('.studio-writing-surface')!;
    const role = (name: string) => {
      const probe = document.createElement('div');
      probe.style.background = `var(${name})`;
      root.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    };
    return {
      heading: getComputedStyle(heading).backgroundColor,
      headingRole: role('--color-surface-container'),
      canvas: getComputedStyle(canvas).backgroundColor,
      canvasRole: role('--color-surface-container-lowest'),
    };
  });
  expect(surfaces.heading).toBe(surfaces.headingRole);
  expect(surfaces.canvas).toBe(surfaces.canvasRole);
  await editor.fill(
    'This private writing belongs here. And the editor is still working.'
  );
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes saved' })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Writing content' })
  ).toContainText('And the editor is still working.');
  await expect(page.locator('.studio-document-opening')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('writing-md3-viewport.png'),
  });
  await page.getByRole('button', { name: 'Writing details' }).click();
  await expect(
    page.getByRole('heading', { name: 'Writing details' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to writing' }).click();
  await expect(
    page.getByRole('region', { name: 'Writing editor' })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBeTruthy();
});
test('the signed owner can edit, save, reload and review a private writing', async ({
  page,
  request,
}, testInfo) => {
  const draft = await createWriting(request, 'An ordinary beginning');
  await page.goto(`/studio/${draft.id}`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'An ordinary beginning'
  );
  await page
    .getByLabel('Title', { exact: true })
    .fill('A thought worth keeping');
  const editor = page.getByRole('textbox', { name: 'Writing content' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' And a second sentence.');
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes saved' })
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'A thought worth keeping'
  );
  await expect(editor).toContainText('And a second sentence.');
  const byline = await page
    .locator('.studio-byline')
    .first()
    .evaluate((element) =>
      Array.from(
        element.querySelectorAll('button, [role="status"], :scope > span')
      )
        .filter((node) => !node.closest('[popover]'))
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        }))
    );
  for (let i = 0; i < byline.length; i++)
    for (let j = i + 1; j < byline.length; j++)
      expect(
        byline[i].right <= byline[j].left + 1 ||
          byline[j].right <= byline[i].left + 1 ||
          byline[i].bottom <= byline[j].top + 1 ||
          byline[j].bottom <= byline[i].top + 1
      ).toBeTruthy();
  await writingAction(page, 'Review publication');
  await expect(
    page.getByRole('heading', { name: 'Review publication', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Review publication', exact: true })
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Publish this revision', exact: true })
  ).toBeEnabled();
  await expect(page.getByText(/^Saved revision \d+$/)).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Tags', exact: true })
  ).toContainText('Thoughts');
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-review-read.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Portable preview', exact: true })
    .click();
  const portableFrame = page.frameLocator(
    'iframe[title="Portable writing preview"]'
  );
  await expect(portableFrame.locator('body')).toContainText(
    'And a second sentence.'
  );
  await expect(page.getByTitle('Portable writing preview')).not.toHaveAttribute(
    'srcdoc',
    ''
  );
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-review-portable.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Back to writing' }).click();
  const results = await new AxeBuilder({ page })
    .include('.studio-editor')
    .analyze();
  expect(results.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBeTruthy();
  await settledScreenshot(page, {
    path: testInfo.outputPath('writing-studio.png'),
    fullPage: true,
  });
  await page.goto(`/writings/${draft.slug}`);
  await expect(
    page.getByRole('heading', { name: 'A thought worth keeping', exact: true })
  ).toBeVisible();
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-matching-reading.png'),
    fullPage: true,
  });
});
test('a stale revision retains local changes and requires explicit recovery', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'Shared revision');
  await page.goto(`/studio/${draft.id}`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Shared revision'
  );
  const response = await request.put(`/api/studio/documents/${draft.id}`, {
    headers: { Origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      expectedRevisionId: draft.head.id,
      body: { ...draft.head.body, title: 'Saved in another tab' },
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.getByLabel('Title', { exact: true }).fill('My retained thought');
  await expect(
    page.getByRole('alert').filter({ hasText: 'A newer revision exists' })
  ).toContainText('A newer revision exists');
  await page.reload();
  await expect(
    page.getByText('There are unsaved changes from your last visit.')
  ).toBeVisible();
  await page.getByRole('button', { name: 'Recover changes' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'My retained thought'
  );
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes saved' })
  ).toBeVisible();
});
test('offline edits recover on reload and save when the connection returns', async ({
  page,
  request,
  context,
}) => {
  const draft = await createWriting(request, 'Before the connection');
  await page.goto(`/studio/${draft.id}`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Before the connection'
  );
  await context.setOffline(true);
  await page.getByLabel('Title', { exact: true }).fill('A thought offline');
  await expect(
    page.getByRole('status').filter({ hasText: 'Offline' })
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes saved' })
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'A thought offline'
  );
});
test('the preview denies unauthenticated requests and public discovery endpoints', async ({
  playwright,
  request,
}) => {
  const anonymous = await playwright.request.newContext({
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    extraHTTPHeaders: { 'cf-access-jwt-assertion': '' },
  });
  expect((await anonymous.get('/studio')).status()).toBe(401);
  expect((await anonymous.get('/api/studio/documents')).status()).toBe(401);
  expect((await request.get('/feed.xml')).status()).toBe(404);
  expect((await request.get('/sitemap.xml')).status()).toBe(404);
  await anonymous.dispose();
});

test('edits made during an in-flight save are saved in the next revision', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'Before a slow save');
  await page.goto(`/studio/${draft.id}`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Before a slow save'
  );
  let delayed = false;
  await page.route(`**/api/studio/documents/${draft.id}`, async (route) => {
    if (route.request().method() === 'PUT' && !delayed) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 2200));
    }
    await route.continue();
  });
  await page.getByLabel('Title', { exact: true }).fill('The first change');
  await expect(
    page.getByRole('status').filter({ hasText: 'Saving…' })
  ).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('The second change');
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes saved' })
  ).toBeVisible();
  await expect
    .poll(async () => {
      const saved = await (
        await request.get(`/api/studio/documents/${draft.id}`)
      ).json();
      return saved.head.body.title;
    })
    .toBe('The second change');
});

for (const scenario of [
  {
    name: 'a preview response for an older draft cannot enable publication',
    finalTitle: 'A newer unreviewed thought',
  },
  {
    name: 'editing back to identical content still retires an in-flight publication review',
    finalTitle: 'A preview in progress',
  },
]) {
  test(scenario.name, async ({ page, request }) => {
    const draft = await createWriting(request, 'A preview in progress');
    await page.goto(`/studio/${draft.id}`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'A preview in progress'
    );
    let releasePreview!: () => void;
    const pendingPreview = new Promise<void>((resolve) => {
      releasePreview = resolve;
    });
    await page.route('**/api/studio/preview', async (route) => {
      await pendingPreview;
      await route.continue();
    });
    const requested = page.waitForRequest(
      (request) =>
        request.url().endsWith('/api/studio/preview') &&
        request.method() === 'POST'
    );
    await writingAction(page, 'Review publication');
    await requested;
    await page
      .getByLabel('Title', { exact: true })
      .fill('An intermediate unreviewed thought');
    await page.getByLabel('Title', { exact: true }).fill(scenario.finalTitle);
    await expect(
      page.getByRole('status').filter({ hasText: 'All changes saved' })
    ).toBeVisible();
    releasePreview();
    await expect(
      page.getByRole('status').filter({ hasText: 'Review it again' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Publish this revision', exact: true })
    ).toHaveCount(0);
  });
}

test('catalog blocks retain their editable properties and imported MDX on reload', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'A page with an aside');
  const source = '<Callout title="Original">Kept exactly.</Callout>';
  const imported = await request.put(`/api/studio/documents/${draft.id}`, {
    headers: { Origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      expectedRevisionId: draft.head.id,
      body: {
        ...draft.head.body,
        document: {
          ...draft.head.body.document,
          content: [
            ...draft.head.body.document.content,
            { type: 'mdxSource', attrs: { source } },
          ],
        },
      },
    },
  });
  expect(imported.ok()).toBeTruthy();
  await page.goto(`/studio/${draft.id}`);
  await expect(page.getByLabel('MDX source', { exact: true })).toHaveValue(
    source
  );
  await page.getByRole('textbox', { name: 'Writing content' }).click();
  await page.getByRole('button', { name: 'Insert block' }).click();
  await page.getByRole('button', { name: 'Callout', exact: true }).click();
  const block = page.locator('.studio-catalog-block');
  await expect(block).toBeVisible();
  await block.getByRole('button', { name: 'Edit block' }).click();
  const settings = page.getByRole('dialog', { name: 'Callout' });
  await settings
    .getByRole('textbox', { name: /^Title/ })
    .fill('An important aside');
  await settings
    .getByRole('textbox', { name: 'Content', exact: true })
    .fill('This deserves a little room.');
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes saved' })
  ).toBeVisible();
  await page.reload();
  await block.getByRole('button', { name: 'Edit block' }).click();
  await expect(settings.getByRole('textbox', { name: /^Title/ })).toHaveValue(
    'An important aside'
  );
  await expect(
    settings.getByRole('textbox', { name: 'Content', exact: true })
  ).toHaveValue('This deserves a little room.');
  await expect(page.getByLabel('MDX source', { exact: true })).toHaveValue(
    source
  );
  await settings.getByRole('button', { name: 'Close widget settings' }).click();
  await writingAction(page, 'Read preview');
  await expect(
    page.locator('.studio-review-screen').getByRole('note')
  ).toContainText('This deserves a little room.');
  await page
    .getByRole('button', { name: 'Portable preview', exact: true })
    .click();
  await expect(page.getByTitle('Portable writing preview')).toBeVisible();
  const portable = page.frameLocator(
    'iframe[title="Portable writing preview"]'
  );
  await expect(portable.locator('body')).toContainText(
    'This deserves a little room.'
  );
  await page.getByRole('button', { name: 'Read', exact: true }).click();
  await page
    .getByRole('button', { name: 'Portable preview', exact: true })
    .click();
  await expect(portable.locator('body')).toContainText(
    'This deserves a little room.'
  );
  await page.getByText('Plain text version', { exact: true }).click();
  await expect(page.locator('.studio-review-screen pre')).toContainText(
    'This deserves a little room.'
  );
});

test('only the author can change prose; Lattice APIs reject current and legacy prose requests', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'Author-owned prose');
  for (const kind of ['writing', 'selection', 'block']) {
    const response = await request.post('/api/studio/generations', {
      headers: { Origin: process.env.STUDIO_TEST_ORIGIN! },
      data: {
        documentId: draft.id,
        revisionId: draft.head.id,
        kind,
        prompt: 'Legacy request',
      },
    });
    expect(response.status()).toBe(400);
    const { Pool } = await import('pg');
    const { randomUUID } = await import('node:crypto');
    const pool = new Pool({
      connectionString: process.env.STUDIO_DATABASE_URL,
    });
    const id = randomUUID();
    try {
      await pool.query(
        'INSERT INTO studio_generations(id,document_id,revision_id,body) VALUES($1,$2,$3,$4)',
        [
          id,
          draft.id,
          draft.head.id,
          JSON.stringify({
            id,
            documentId: draft.id,
            revisionId: draft.head.id,
            kind,
            prompt: 'Legacy request',
            status: 'ready',
            result: 'Unwanted prose',
            error: null,
          }),
        ]
      );
    } finally {
      await pool.end();
    }
    expect((await request.get(`/api/studio/generations/${id}`)).status()).toBe(
      400
    );
    for (const action of ['accept', 'retry'])
      expect(
        (
          await request.patch(`/api/studio/generations/${id}`, {
            headers: { Origin: process.env.STUDIO_TEST_ORIGIN! },
            data: { action, expectedRevisionId: draft.head.id },
          })
        ).status()
      ).toBe(400);
  }
  const unchanged = await (
    await request.get(`/api/studio/documents/${draft.id}`)
  ).json();
  expect(unchanged.head.id).toBe(draft.head.id);
  await page.addInitScript((documentId) => {
    sessionStorage.setItem(
      `studio-request:${documentId}`,
      JSON.stringify({ kind: 'writing', prompt: 'An obsolete prose request' })
    );
  }, draft.id);
  await page.goto(`/studio/${draft.id}`);
  await writingAction(page, 'Create widget');
  await expect(
    page.getByRole('textbox', { name: 'Describe the widget', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Describe the widget', exact: true })
  ).toHaveValue('');
  await expect(
    page.getByRole('combobox', { name: 'Work on', exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: /Replace writing|Replace selected text|Revise selected text/,
    })
  ).toHaveCount(0);
});

test('choose a named personal device after connection and retain the server selection', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'A personal widget runtime');
  let connected = false;
  let selectedRuntimeId: string | null = null;
  const devices = [
    { id: 'mac-personal', name: 'Willie’s Mac', status: 'reachable' },
    { id: 'laptop-personal', name: 'Travel laptop', status: 'offline' },
    { id: 'removed-personal', name: 'Old computer', status: 'revoked' },
  ];
  await page.route('**/api/studio/lattice/runtime', async (route) => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().postDataJSON()).toEqual({
        runtimeId: 'laptop-personal',
      });
      selectedRuntimeId = 'laptop-personal';
    }
    await route.fulfill({
      json: { connected, devices: connected ? devices : [], selectedRuntimeId },
    });
  });
  await page.goto(`/studio/${draft.id}`);
  await writingAction(page, 'Create widget');
  await expect(
    page.getByText('Connect Lattice to choose your Lovelace device.', {
      exact: true,
    })
  ).toBeVisible();
  await page
    .getByLabel('Describe the widget', { exact: true })
    .fill('Build an interactive chart.');
  await expect(
    page.getByRole('button', { name: 'Generate widget', exact: true })
  ).toBeDisabled();
  connected = true;
  await page
    .getByRole('button', { name: 'Refresh devices', exact: true })
    .click();
  const picker = page.getByRole('combobox', {
    name: 'Personal device',
    exact: true,
  });
  await expect(
    picker.getByRole('option', { name: 'Willie’s Mac · Online', exact: true })
  ).toHaveCount(1);
  await expect(
    picker.getByRole('option', {
      name: 'Old computer · Access removed',
      exact: true,
    })
  ).toHaveJSProperty('disabled', true);
  await expect(
    page.getByRole('button', { name: 'Generate widget', exact: true })
  ).toBeDisabled();
  await picker.selectOption('laptop-personal');
  await page.getByText('Personal device connected', { exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Travel laptop is offline.' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Generate widget', exact: true })
  ).toBeEnabled();
  await page.reload();
  await writingAction(page, 'Create widget');
  await page.getByText('Personal device connected', { exact: true }).click();
  await expect(picker).toHaveValue('laptop-personal');
  await expect(page.locator('.site-breadcrumbs')).toBeVisible();
});

test('private reading uses native writing cards, headers and note typography', async ({
  page,
  request,
}, testInfo) => {
  const title = `A native private article ${testInfo.project.name}`;
  const draft = await createWriting(request, title);
  await page.goto('/writings');
  const card = page.locator('article.h-entry').filter({ hasText: title });
  await expect(card).toHaveClass(/bg-card/);
  await expect(card.getByText('Draft', { exact: true })).toBeVisible();
  await expect(card.getByText('Edit writing')).toHaveCount(0);
  await card.getByRole('link', { name: title, exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: title })
  ).toBeVisible();
  await expect(page.locator('main:visible header')).toHaveClass(
    /max-w-breakpoint-md/
  );
  await expect(page.locator('main:visible .prose p')).toHaveCSS(
    'font-size',
    '16px'
  );
  await expect(
    page.getByRole('link', { name: 'Edit writing', exact: true })
  ).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => {}))
    );
  });
  await settledScreenshot(page, {
    path: testInfo.outputPath('native-reading-article.png'),
    fullPage: true,
  });
  const note = await request.put(`/api/studio/documents/${draft.id}`, {
    headers: { Origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      expectedRevisionId: draft.head.id,
      body: { ...draft.head.body, title: '', postType: 'note' },
    },
  });
  expect(note.ok(), await note.text()).toBeTruthy();
  await page.reload();
  await expect(page.locator('main:visible h1')).toHaveClass(/sr-only/);
  await expect(page.locator('main:visible .prose p')).toHaveCSS(
    'font-size',
    '18px'
  );
  await expect(page.locator('main:visible .prose')).toContainText(
    'This private writing belongs here.'
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBeTruthy();
  const accessibility = await new AxeBuilder({ page })
    .include('main')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => {}))
    );
  });
  await settledScreenshot(page, {
    path: testInfo.outputPath('native-reading-note.png'),
    fullPage: true,
  });
});

test('the native library opens a blank writing directly and allows a title later', async ({
  page,
  request,
}, testInfo) => {
  const existing = await createWriting(
    request,
    'A published thought with new changes'
  );
  await page.route('**/api/studio/documents', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    data.documents = data.documents.map(
      (draft: { id: string; liveRevisionId: string | null }) =>
        draft.id === existing.id
          ? { ...draft, liveRevisionId: 'previous-published-revision' }
          : draft
    );
    await route.fulfill({ response, json: data });
  });
  await page.goto('/studio');
  await expect(
    page.getByRole('heading', { name: 'Your writings', exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('Unpublished changes', { exact: true })
  ).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => {}))
    );
  });
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-library.png'),
  });
  const trigger = page.getByRole('button', {
    name: 'New writing',
    exact: true,
  });
  await trigger.click();
  const editor = page.getByRole('textbox', { name: 'Writing content' });
  await expect(editor).toBeFocused();
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0);
  await expect(page.locator('.studio-writing-space')).toHaveAttribute(
    'data-empty',
    'true'
  );
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-blank-entry.png'),
    fullPage: true,
  });
  await page.keyboard.type('A beginning without a title.');
  await expect(editor).toContainText('A beginning without a title.');
  const canvas = page.locator('.studio-writing-space');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const whitespace = await canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    for (let y = bounds.height - 4; y > 0; y -= 4) {
      for (const x of [bounds.width / 2, 8, bounds.width - 8]) {
        if (
          document.elementFromPoint(bounds.left + x, bounds.top + y) === element
        )
          return { x, y };
      }
    }
    return null;
  });
  expect(
    whitespace,
    'The canvas exposes whitespace outside its controls'
  ).not.toBeNull();
  await canvas.click({ position: whitespace! });
  await expect(editor).toBeFocused();
  await page.keyboard.type(' Keep going.');
  await expect(editor).toContainText(
    'A beginning without a title. Keep going.'
  );
  await page.keyboard.press('ControlOrMeta+/');
  await expect(
    page.getByRole('button', { name: 'Heading', exact: true })
  ).toBeFocused();
  const menu = await page.locator('[popover]:popover-open').boundingBox();
  const prose = await editor.boundingBox();
  expect(Math.abs(menu!.y - prose!.y)).toBeLessThan(110);
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-cursor-menu.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(editor).toBeFocused();
  await page.getByRole('button', { name: 'Add a title', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toBeFocused();
  await page.getByLabel('Title', { exact: true }).fill('A fresh page');
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-new-writing.png'),
    fullPage: true,
  });
});

test('native writing fields wrap and contextual tasks preserve the reading position', async ({
  page,
  request,
}, testInfo) => {
  if (testInfo.project.name === 'studio-dark')
    await page.emulateMedia({ reducedMotion: 'reduce' });
  const draft = await createWriting(
    request,
    'A long title about the things we notice when we take a moment to look around and write them down'
  );
  await page.goto(`/studio/${draft.id}`);
  const title = page.getByLabel('Title', { exact: true });
  await expect(title).toBeVisible();
  expect((await title.boundingBox())!.height).toBeGreaterThan(48);
  await expect(page.locator('#main')).toBeVisible();
  const date = page.getByRole('button', { name: 'Edit writing date' });
  await date.click();
  await expect(page.getByLabel('Writing date', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(date).toBeFocused();
  const tags = page.getByRole('button', { name: 'Edit tags' });
  await tags.click();
  await expect(page.getByLabel('Tags', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tags).toBeFocused();
  const editor = page.getByRole('textbox', { name: 'Writing content' });
  await editor.focus();
  const before = await editor.boundingBox();
  await editor.evaluate((element) => {
    const range = document.createRange();
    const text = element.querySelector('p')!.firstChild!;
    range.setStart(text, 0);
    range.setEnd(text, 5);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect(
    page.getByRole('toolbar', { name: 'Selection tools' })
  ).toBeVisible();
  expect((await editor.boundingBox())!.y).toBe(before!.y);
  await expect(
    page.getByRole('button', { name: 'Revise selected text' })
  ).toHaveCount(0);
  await writingAction(page, 'Create widget');
  await expect(
    page.getByRole('heading', { name: 'Create widget', exact: true })
  ).toBeFocused();
  await expect(editor).toBeHidden();
  if (testInfo.project.name === 'studio-dark')
    await expect(page.locator('section.studio-task')).toHaveCSS(
      'animation-name',
      'none'
    );
  await page
    .getByRole('button', { name: 'Back to writing', exact: true })
    .click();
  await expect(editor).toBeFocused();
  expect(await editor.evaluate(() => window.getSelection()?.toString())).toBe(
    'This '
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => {}))
    );
  });
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-long-title.png'),
    fullPage: true,
  });
  await writingAction(page, 'Revision history');
  await expect(
    page.getByRole('heading', { name: 'Revision history', exact: true })
  ).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => {}))
    );
  });
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-history.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Back to writing', exact: true })
    .click();
  await writingAction(page, 'Writing details');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => {}))
    );
  });
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-details.png'),
    fullPage: true,
  });
  await page
    .getByRole('combobox', { name: 'Format', exact: true })
    .selectOption('note');
  await page
    .getByRole('button', { name: 'Back to writing', exact: true })
    .click();
  await expect(title).toBeHidden();
  await expect(editor).toHaveClass(/prose-xl/);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => {}))
    );
  });
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-note.png'),
    fullPage: true,
  });
  const results = await new AxeBuilder({ page })
    .include('.studio-editor')
    .analyze();
  expect(results.violations).toEqual([]);
});

test('a waiting widget request stops polling until the owner retries', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'A widget connection check');
  await page.route('**/api/studio/lattice/runtime', (route) =>
    route.fulfill({
      json: {
        connected: true,
        devices: [
          { id: 'personal-test-device', name: 'Test Mac', status: 'reachable' },
        ],
        selectedRuntimeId: 'personal-test-device',
      },
    })
  );
  let polls = 0;
  await page.route('**/api/studio/generations/waiting-generation', (route) => {
    polls += 1;
    return route.fulfill({
      json: {
        id: 'waiting-generation',
        documentId: draft.id,
        kind: 'component',
        status: 'waiting',
        result: null,
        error: 'Personal runtime unavailable.',
      },
    });
  });
  await page.route('**/api/studio/generations', (route) =>
    route.fulfill({
      status: 202,
      json: {
        id: 'waiting-generation',
        documentId: draft.id,
        kind: 'component',
        status: 'waiting',
        result: null,
        error: 'Personal runtime unavailable.',
      },
    })
  );
  await page.goto(`/studio/${draft.id}`);
  await writingAction(page, 'Create widget');
  await page
    .getByLabel('Describe the widget', { exact: true })
    .fill('A counter.');
  await page
    .getByRole('button', { name: 'Generate widget', exact: true })
    .click();
  await expect(page.getByText('Waiting for your device…')).toBeVisible();
  await page.waitForTimeout(3500);
  expect(polls).toBe(0);
});

test('an approved generated component is editable beside its paragraph', async ({
  page,
  request,
}, testInfo) => {
  const draft = await createWriting(
    request,
    'A page with a personal component'
  );
  await page.route('**/api/studio/lattice/runtime', (route) =>
    route.fulfill({
      json: {
        connected: true,
        devices: [
          { id: 'personal-test-device', name: 'Test Mac', status: 'reachable' },
        ],
        selectedRuntimeId: 'personal-test-device',
      },
    })
  );
  await page.route('**/api/studio/generations', async (route) => {
    const input = route.request().postDataJSON();
    expect(input.kind).toBe('component');
    const { Pool } = await import('pg');
    const { randomUUID } = await import('node:crypto');
    const pool = new Pool({
      connectionString: process.env.STUDIO_DATABASE_URL,
    });
    const generation = {
      id: randomUUID(),
      ...input,
      status: 'ready',
      error: null,
      result: JSON.stringify({
        name: 'InteractiveSidebarWithAnAccessibleStaticAlternative',
        description: 'A small personal aside.',
        version: '1.0.0',
        source:
          "import React from 'react';export default function InteractiveSidebarWithAnAccessibleStaticAlternative({label}){return <p>{label}</p>}",
        portableHtml: '<p>A small thought.</p>',
        portableText: 'A small thought.',
        properties: {
          label: {
            type: 'string',
            required: true,
            description: 'The thought to display.',
          },
        },
        example: { label: 'A small thought.' },
        accessibility: 'The thought is readable paragraph text.',
      }),
    };
    try {
      await pool.query(
        'INSERT INTO studio_generations(id,document_id,revision_id,body) VALUES($1,$2,$3,$4)',
        [generation.id, draft.id, input.revisionId, JSON.stringify(generation)]
      );
    } finally {
      await pool.end();
    }
    // Substitute only provider inference; proposal parsing, sandbox compilation,
    // approval, catalog refresh, insertion and revision saving use real routes.
    await route.fulfill({ status: 202, json: generation });
  });
  await page.goto(`/studio/${draft.id}`);
  const editor = page.getByRole('textbox', { name: 'Writing content' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await writingAction(page, 'Create widget');
  await page
    .getByLabel('Describe the widget', { exact: true })
    .fill('Make a reusable personal aside.');
  await page
    .getByRole('button', { name: 'Generate widget', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Build isolated preview', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'InteractiveSidebarWithAnAccessibleStaticAlternative',
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="Proposed component sandbox"]')
      .frameLocator(
        'iframe[title="InteractiveSidebarWithAnAccessibleStaticAlternative"]'
      )
      .getByText('A small thought.', { exact: true })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Approve component for catalog', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Insert approved component', exact: true })
    .click();
  const block = page.locator('.studio-catalog-block');
  await expect(block.locator('.studio-widget-type')).toHaveText(
    'Interactive Sidebar With An Accessible Static Alternative'
  );
  await block.getByRole('button', { name: 'Edit block' }).click();
  const settings = page.getByRole('dialog', {
    name: 'Interactive Sidebar With An Accessible Static Alternative',
  });
  const property = settings.getByRole('textbox', { name: /^Label/ });
  await expect(property).toHaveValue('A small thought.');
  expect(
    await block.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1
    )
  ).toBeTruthy();
  await property.fill('Another useful thought.');
  await settings.getByText('Feed alternative').click();
  await settings
    .getByRole('textbox', { name: 'Feed alternative' })
    .fill('Another useful thought.');
  await settings.getByRole('button', { name: 'Confirm alternative' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes saved' })
  ).toBeVisible();
  const paragraphs = await editor.locator(':scope > p').allTextContents();
  expect(paragraphs.join('')).toBe('This private writing belongs here.');
  expect(paragraphs[0]).toBe('This private writing belongs here.');
  await settledScreenshot(page, {
    path: testInfo.outputPath('studio-approved-component.png'),
    fullPage: true,
  });
  await page.reload();
  await expect(block.locator('.studio-widget-type')).toHaveText(
    'Interactive Sidebar With An Accessible Static Alternative'
  );
  await block.getByRole('button', { name: 'Edit block' }).click();
  await expect(property).toHaveValue('Another useful thought.');
});

test('untitled prose is recognizable after returning and creation is available again', async ({
  page,
}) => {
  await page.goto('/studio');
  const create = page.getByRole('button', { name: 'New writing', exact: true });
  await expect(create.locator('svg')).toHaveCount(1);
  await expect(
    page.getByText('Working copies, saved privately.', { exact: true })
  ).toHaveCount(0);
  await create.click();
  const editor = page.getByRole('textbox', { name: 'Writing content' });
  await expect(editor).toBeFocused({ timeout: 15000 });
  const sentence = `A recognizable beginning ${Date.now()}.`;
  await editor.fill(sentence);
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes saved' })
  ).toBeVisible();
  await page.goBack();
  await expect(create).toBeEnabled();
  await page
    .getByRole('link', { name: `Edit ${sentence}`, exact: true })
    .click();
  await expect(editor).toHaveText(sentence);
});

test('a composed widget request survives connection navigation and returns to its writing', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'A retained widget request');
  await page.goto(`/studio/${draft.id}`);
  await writingAction(page, 'Create widget');
  await page
    .getByLabel('Describe the widget', { exact: true })
    .fill('Build an inline chart with an accessible static table.');
  const connect = page.getByRole('link', {
    name: 'Connect Lattice',
    exact: true,
  });
  await expect(connect).toHaveAttribute(
    'href',
    `/api/studio/lattice/connect?returnTo=${encodeURIComponent(`/studio/${draft.id}?components=1`)}`
  );
  // A fresh page mount models the return from external OAuth without using real credentials.
  await page.goto('/studio');
  await page.goto(`/studio/${draft.id}?components=1`);
  await expect(
    page.getByRole('heading', { name: 'Create widget', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Describe the widget', exact: true })
  ).toHaveValue('Build an inline chart with an accessible static table.');
  await expect(
    page.getByRole('combobox', { name: 'Work on', exact: true })
  ).toHaveCount(0);
});

test('inline controls follow a middle paragraph and preserve selected prose', async ({
  page,
  request,
}, testInfo) => {
  const draft = await createWriting(request, 'Inline editing');
  const paragraphs = Array.from({ length: 18 }, (_, index) => ({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: `Paragraph ${index + 1}. A sentence that stays where its author put it.`,
      },
    ],
  }));
  const saved = await request.put(`/api/studio/documents/${draft.id}`, {
    headers: { Origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      expectedRevisionId: draft.head.id,
      body: {
        ...draft.head.body,
        document: {
          type: 'doc',
          content: [
            ...paragraphs,
            {
              type: 'bulletList',
              content: Array.from({ length: 20 }, (_, index) => ({
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: `List item ${index + 1}. Kept in place.`,
                      },
                    ],
                  },
                ],
              })),
            },
          ],
        },
      },
    },
  });
  expect(saved.ok()).toBeTruthy();
  await page.goto(`/studio/${draft.id}`);
  const paragraph = page.locator('.studio-prose > p').nth(8);
  await paragraph.scrollIntoViewIfNeeded();
  await paragraph.click();
  const add = page.getByRole('button', {
    name: 'Insert block',
    exact: true,
  });
  await expect(async () => {
    const block = await paragraph.boundingBox();
    const button = await add.boundingBox();
    expect(block).not.toBeNull();
    expect(button).not.toBeNull();
    expect(button!.height).toBeGreaterThanOrEqual(48);
    if (testInfo.project.name === 'studio-phone') {
      expect(button!.y).toBeGreaterThanOrEqual(block!.y + block!.height);
      expect(button!.y - block!.y - block!.height).toBeLessThan(20);
      const next = await page.locator('.studio-prose > p').nth(9).boundingBox();
      expect(next!.y).toBeGreaterThanOrEqual(button!.y + button!.height);
    } else {
      expect(Math.abs(button!.y - block!.y)).toBeLessThan(5);
      expect(button!.x + button!.width).toBeLessThanOrEqual(block!.x);
    }
  }).toPass();
  await paragraph.evaluate((element) => {
    const range = document.createRange();
    range.setStart(element.firstChild!, 0);
    range.setEnd(element.firstChild!, 11);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  const bold = page.getByRole('button', { name: 'Bold', exact: true });
  await expect(bold).toBeVisible();
  await expect(bold).toHaveAttribute('aria-pressed', 'false');
  const boldBounds = (await bold.boundingBox())!;
  await page.mouse.move(
    boldBounds.x + boldBounds.width / 2,
    boldBounds.y + boldBounds.height / 2
  );
  await page.mouse.down();
  try {
    await expect
      .poll(() =>
        bold.evaluate((element) => getComputedStyle(element).borderRadius)
      )
      .toBe('8px');
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      'Paragraph 9'
    );
    expect(await bold.boundingBox()).toEqual(boldBounds);
  } finally {
    await page.mouse.up();
  }
  await expect(paragraph.locator('strong')).toHaveText('Paragraph 9');
  await expect(bold).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  const linkAddress = page.getByRole('textbox', { name: 'Link address' });
  await expect(linkAddress).toBeFocused();
  const mediaBounds = await page.locator('.studio-inline-media').boundingBox();
  const sourceBounds = await paragraph.boundingBox();
  expect(
    Math.abs(mediaBounds!.y - sourceBounds!.y - sourceBounds!.height)
  ).toBeLessThan(20);
  await linkAddress.fill('https://example.com/');
  await writingAction(page, 'Writing details');
  await page
    .getByRole('button', { name: 'Back to writing', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Writing content' })
  ).toBeFocused();
  await expect(linkAddress).toHaveValue('https://example.com/');
  await page.getByRole('button', { name: 'Read preview', exact: true }).click();
  await page
    .getByRole('button', { name: 'Portable preview', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Back to writing', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Writing content' })
  ).toBeFocused();
  await expect(linkAddress).toHaveValue('https://example.com/');
  await page.getByRole('button', { name: 'Add link', exact: true }).click();
  await expect(paragraph.locator('a')).toHaveText('Paragraph 9');
  await add.click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('textbox', { name: 'Writing content' })
  ).toBeFocused();
  await add.click();
  await page.getByRole('button', { name: 'Callout', exact: true }).click();
  const block = page.locator('.studio-catalog-block');
  await expect(block).toBeVisible();
  await expect(paragraph).toHaveText(
    'Paragraph 9. A sentence that stays where its author put it.'
  );
  await expect(page.locator('.studio-prose > p').nth(9)).toHaveText(
    'Paragraph 10. A sentence that stays where its author put it.'
  );
  await block.getByRole('button', { name: 'Edit block', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Callout' });
  const title = settings.getByRole('textbox', { name: /^Title/ });
  await expect(
    settings.getByRole('heading', { name: 'Callout' })
  ).toBeFocused();
  await title.fill('A local aside');
  await title.press('Escape');
  await expect(
    block.getByRole('button', { name: 'Edit block', exact: true })
  ).toBeFocused();
  await settledScreenshot(page, {
    path: `/tmp/studio-inline-${testInfo.project.name}.png`,
  });
  await expect(
    page.getByRole('status').filter({ hasText: 'All changes saved' })
  ).toBeVisible();
  await page.reload();
  await block.getByRole('button', { name: 'Edit block', exact: true }).click();
  await expect(title).toHaveValue('A local aside');
  await settings.getByRole('button', { name: 'Close widget settings' }).click();
  const listParagraph = page.locator('.studio-prose li p').nth(9);
  await listParagraph.scrollIntoViewIfNeeded();
  await listParagraph.click();
  await expect(async () => {
    const itemBounds = await listParagraph.boundingBox();
    const addBounds = await add.boundingBox();
    const expectedTop =
      testInfo.project.name === 'studio-phone'
        ? itemBounds!.y + itemBounds!.height + 8
        : itemBounds!.y;
    expect(Math.abs(addBounds!.y - expectedTop)).toBeLessThan(5);
  }).toPass();
});

test('an unfinished image retains its file and description across tasks and previews', async ({
  page,
  request,
}, testInfo) => {
  const draft = await createWriting(request, 'An image draft');
  await page.goto(`/studio/${draft.id}`);
  const editor = page.getByRole('textbox', { name: 'Writing content' });
  await editor.click();
  await page.getByRole('button', { name: 'Insert block', exact: true }).click();
  await page.getByRole('button', { name: 'Image', exact: true }).click();
  const file = page.getByLabel('Image file', { exact: true });
  const description = page.getByRole('textbox', {
    name: 'Image description',
    exact: true,
  });
  await file.setInputFiles({
    name: 'retained.png',
    mimeType: 'image/png',
    buffer: Buffer.from('image draft'),
  });
  await description.fill('A description still being composed.');
  await page.mouse.move(0, 0);
  const insert = page.getByRole('button', {
    name: 'Insert image',
    exact: true,
  });
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  await expect(insert.locator('.site-control__surface')).not.toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)'
  );
  await expect(cancel.locator('.site-control__surface')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)'
  );
  await insert.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('media-action-hierarchy.png'),
  });
  await writingAction(page, 'Writing details');
  await page
    .getByRole('button', { name: 'Back to writing', exact: true })
    .click();
  await expect(editor).toBeFocused();
  await expect(description).toHaveValue('A description still being composed.');
  await page.getByRole('button', { name: 'Read preview', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Read your writing', exact: true })
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Portable preview', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Back to writing', exact: true })
    .click();
  await expect(editor).toBeFocused();
  await expect(description).toHaveValue('A description still being composed.');
  await expect
    .poll(() =>
      file.evaluate((input: HTMLInputElement) => input.files?.[0]?.name)
    )
    .toBe('retained.png');
});

test('an image upload follows edits without taking focus from a preview', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'An image in progress');
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  let finishUpload!: () => void;
  const complete = new Promise<void>((resolve) => {
    finishUpload = resolve;
  });
  const imageURL = '/brand/lockups/png/williecubed-wordmark-ink@2x.png';
  await page.route('**/api/studio/assets', async (route) => {
    expect(route.request().method()).toBe('POST');
    markStarted();
    await complete;
    await route.fulfill({ json: { url: imageURL } });
  });
  await page.goto(`/studio/${draft.id}`);
  const editor = page.getByRole('textbox', { name: 'Writing content' });
  const original = 'The paragraph before the image.';
  await editor.fill(original);
  await editor.press('End');
  await page.getByRole('button', { name: 'Insert block', exact: true }).click();
  await page.getByRole('button', { name: 'Image', exact: true }).click();
  await page.getByLabel('Image file', { exact: true }).setInputFiles({
    name: 'in-progress.png',
    mimeType: 'image/png',
    buffer: Buffer.from('local client upload fixture'),
  });
  await page
    .getByLabel('Image description', { exact: true })
    .fill('A mapped image');
  await page.getByRole('button', { name: 'Insert image', exact: true }).click();
  await started;

  try {
    await editor.focus();
    await editor.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await page.keyboard.type('Added during upload. ');
    await expect(editor).toHaveText(`Added during upload. ${original}`);
    await page
      .getByRole('button', { name: 'Read preview', exact: true })
      .click();
    const heading = page.getByRole('heading', {
      name: 'Read your writing',
      exact: true,
    });
    await expect(heading).toBeFocused();
    finishUpload();

    await expect
      .poll(async () => {
        const response = await request.get(`/api/studio/documents/${draft.id}`);
        const saved = await response.json();
        const nodes = saved.head.body.document.content;
        return {
          text: nodes[0]?.content
            ?.map((node: EditorNode) => node.text || '')
            .join(''),
          image: nodes[1]?.attrs?.props?.src,
          description: nodes[1]?.attrs?.props?.alt,
        };
      })
      .toEqual({
        text: `Added during upload. ${original}`,
        image: imageURL,
        description: 'A mapped image',
      });
    await expect(heading).toBeFocused();
    await page
      .getByRole('button', { name: 'Back to writing', exact: true })
      .click();
    await expect(editor).toBeFocused();
    await expect(page.getByLabel('Image file', { exact: true })).toHaveCount(0);
  } finally {
    finishUpload();
  }
});

function publicationFixture(draft: Draft, id: string): Publication {
  return {
    id,
    documentId: draft.id,
    revisionId: draft.head.id,
    status: 'deploying' as const,
    commit: null,
    error: null,
    createdAt: draft.head.createdAt,
  };
}

async function settleStudioResponse(page: import('@playwright/test').Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}

test('a retained publication response cannot replace a newly submitted publication', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'A newer publication');
  let releaseRetained!: () => void;
  const retained = new Promise<void>((resolve) => {
    releaseRetained = resolve;
  });
  await page.addInitScript((id) => {
    sessionStorage.setItem(`studio-publication:${id}`, 'retained-publication');
  }, draft.id);
  let retainedFinished!: () => void;
  const finished = new Promise<void>((resolve) => {
    retainedFinished = resolve;
  });
  await page.route(
    '**/api/studio/publications/retained-publication',
    async (route) => {
      await retained;
      await route
        .fulfill({
          json: {
            ...publicationFixture(draft, 'retained-publication'),
            status: 'failed',
            error: 'An earlier publication failed.',
          },
        })
        .catch(() => {});
      retainedFinished();
    }
  );
  await page.route('**/api/studio/publications', (route) =>
    route.fulfill({ json: publicationFixture(draft, 'submitted-publication') })
  );
  await page.route(
    '**/api/studio/publications/submitted-publication',
    (route) =>
      route.fulfill({
        json: publicationFixture(draft, 'submitted-publication'),
      })
  );
  const lookup = page.waitForRequest(
    '**/api/studio/publications/retained-publication'
  );
  await page.goto(`/studio/${draft.id}`);
  await lookup;
  await writingAction(page, 'Review publication');
  await page
    .getByRole('button', { name: 'Publish this revision', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Deploying your writing…' })
  ).toBeVisible();
  releaseRetained();
  await finished;
  await settleStudioResponse(page);
  await expect(
    page.getByRole('heading', { name: 'Deploying your writing…' })
  ).toBeVisible();
  await expect(page.getByText('An earlier publication failed.')).toHaveCount(0);
  expect(
    await page.evaluate(
      (id) => sessionStorage.getItem(`studio-publication:${id}`),
      draft.id
    )
  ).toBe('submitted-publication');
});

test('retained publication recovery refuses a job belonging to another writing', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'My own publication');
  await page.addInitScript((id) => {
    sessionStorage.setItem(`studio-publication:${id}`, 'foreign-publication');
  }, draft.id);
  await page.route('**/api/studio/publications/foreign-publication', (route) =>
    route.fulfill({
      json: {
        ...publicationFixture(draft, 'foreign-publication'),
        documentId: 'another-writing',
        status: 'failed',
        error: 'A different writing failed.',
      },
    })
  );
  const response = page.waitForResponse(
    '**/api/studio/publications/foreign-publication'
  );
  await page.goto(`/studio/${draft.id}`);
  await (await response).finished();
  await settleStudioResponse(page);
  await expect(page.getByText('A different writing failed.')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Publication needs attention' })
  ).toHaveCount(0);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'My own publication'
  );
});

test('history failures stay in history and leaving the task cancels its response', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'History belongs to its task');
  let releaseHistory!: () => void;
  const pending = new Promise<void>((resolve) => {
    releaseHistory = resolve;
  });
  let deferHistory = false;
  await page.route(
    `**/api/studio/documents/${draft.id}/revisions`,
    async (route) => {
      if (deferHistory) await pending;
      await route.fulfill({
        status: 503,
        json: { error: 'History is temporarily unavailable.' },
      });
    }
  );
  await page.goto(`/studio/${draft.id}`);
  await writingAction(page, 'Revision history');
  const history = page.getByRole('region', {
    name: 'Revision history',
    exact: true,
  });
  await expect(history.getByRole('alert')).toContainText(
    'History is temporarily unavailable.'
  );
  await expect(history.getByText('No earlier revisions yet.')).toHaveCount(0);
  await expect(page.locator('.studio-save-state')).toContainText(
    'All changes saved'
  );
  deferHistory = true;
  const retried = page.waitForRequest(
    `**/api/studio/documents/${draft.id}/revisions`
  );
  await history
    .getByRole('button', { name: 'Retry history', exact: true })
    .click();
  await retried;
  await page
    .getByRole('button', { name: 'Back to writing', exact: true })
    .click();
  releaseHistory();
  await settleStudioResponse(page);
  await expect(
    page.getByRole('textbox', { name: 'Writing content' })
  ).toBeFocused();
  await expect(page.locator('.studio-save-state')).toContainText(
    'All changes saved'
  );
  await expect(
    page.getByText('History is temporarily unavailable.')
  ).toHaveCount(0);
});

function generationFixture(draft: Draft, id: string): Generation {
  return {
    id,
    documentId: draft.id,
    revisionId: draft.head.id,
    kind: 'component',
    prompt: 'A useful widget.',
    status: 'ready',
    result: null,
    error: null,
  };
}

test('retained generation recovery cannot replace a newly requested widget', async ({
  page,
  request,
}) => {
  const draft = await createWriting(request, 'My new widget request');
  let releaseRetained!: () => void;
  const retained = new Promise<void>((resolve) => {
    releaseRetained = resolve;
  });
  await page.addInitScript((id) => {
    sessionStorage.setItem(`studio-generation:${id}`, 'retained-generation');
  }, draft.id);
  await page.route('**/api/studio/lattice/runtime', (route) =>
    route.fulfill({
      json: {
        connected: true,
        devices: [{ id: 'test-device', name: 'Test Mac', status: 'reachable' }],
        selectedRuntimeId: 'test-device',
      },
    })
  );
  await page.route(
    '**/api/studio/generations/retained-generation',
    async (route) => {
      await retained;
      await route.fulfill({
        json: {
          ...generationFixture(draft, 'retained-generation'),
          status: 'waiting',
          error: 'An earlier request is waiting.',
        },
      });
    }
  );
  await page.route('**/api/studio/generations', (route) =>
    route.fulfill({ json: generationFixture(draft, 'new-generation') })
  );
  const lookup = page.waitForRequest(
    '**/api/studio/generations/retained-generation'
  );
  await page.goto(`/studio/${draft.id}`);
  await lookup;
  await writingAction(page, 'Create widget');
  await page
    .getByLabel('Describe the widget', { exact: true })
    .fill('A counter.');
  await page
    .getByRole('button', { name: 'Generate widget', exact: true })
    .click();
  await expect(
    page.getByText('Widget ready to review', { exact: true })
  ).toBeVisible();
  const response = page.waitForResponse(
    '**/api/studio/generations/retained-generation'
  );
  releaseRetained();
  await (await response).finished();
  await settleStudioResponse(page);
  await expect(
    page.getByText('Widget ready to review', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('An earlier request is waiting.')).toHaveCount(0);
  expect(
    await page.evaluate(
      (id) => sessionStorage.getItem(`studio-generation:${id}`),
      draft.id
    )
  ).toBe('new-generation');
});

test('finishing the library list request cannot erase a creation failure', async ({
  page,
  request,
}, testInfo) => {
  const draft = await createWriting(request, 'An existing library draft');
  let releaseList!: () => void;
  const pending = new Promise<void>((resolve) => {
    releaseList = resolve;
  });
  await page.route('**/api/studio/documents', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 503,
        json: { error: 'Creation is temporarily unavailable.' },
      });
      return;
    }
    await pending;
    await route.fulfill({ json: { documents: [draft] } });
  });
  const listed = page.waitForRequest('**/api/studio/documents');
  await page.goto('/studio');
  await listed;
  await page.getByRole('button', { name: 'New writing', exact: true }).click();
  await expect(
    page.getByText('Creation is temporarily unavailable.')
  ).toBeVisible();
  const response = page.waitForResponse(
    (value) =>
      value.url().endsWith('/api/studio/documents') &&
      value.request().method() === 'GET'
  );
  releaseList();
  await (await response).finished();
  await settleStudioResponse(page);
  await expect(
    page.getByText('Creation is temporarily unavailable.')
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Edit An existing library draft' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'New writing', exact: true })
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBeTruthy();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath('library-creation-error-viewport.png'),
    fullPage: false,
  });
});
