import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { DraftContent } from '@/lib/studio/types';

registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { default: WritingDraftLayout } =
  await import('@/components/studio/WritingDraftLayout');

const body: DraftContent = {
  title: 'Private writing',
  description: 'A retained draft.',
  postType: 'article',
  tags: [],
  document: { type: 'doc', content: [] },
};
function markup(
  hidden: boolean,
  dirty = false,
  liveRevisionId: string | null = 'saved'
) {
  return renderToStaticMarkup(
    createElement(WritingDraftLayout, {
      body,
      savedRevisionId: 'saved',
      liveRevisionId,
      dirty,
      status: dirty ? 'Unsaved changes' : 'All changes saved',
      update: () => undefined,
      hidden,
      published: '2026-10-23',
      minutes: 2,
      controls: createElement('button', null, 'Save writing'),
      children: createElement('input', {
        type: 'file',
        'aria-label': 'Image file',
      }),
    })
  );
}

test('the writing layout hides the retained editor and native file field during preview', () => {
  const writing = markup(false);
  const preview = markup(true);
  assert.match(preview, /<header hidden=""/);
  assert.match(preview, /class="studio-writing-workspace" hidden=""/);
  assert.equal(preview.replaceAll(' hidden=""', ''), writing);
  assert.match(preview, /type="file" aria-label="Image file"/);
});

test('the metadata compares the saved revision and dirty state to publication', () => {
  assert.match(markup(false), />Published</);
  assert.match(markup(false, true), />Unpublished changes</);
  assert.match(markup(false, false, 'older'), />Unpublished changes</);
  assert.match(markup(false, false, null), />Draft</);
});
