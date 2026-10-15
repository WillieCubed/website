import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { default: StatusEditor } =
  await import('../../../components/status/admin/StatusEditor');

test('the status editor renders native city search and save forms from request state', () => {
  const city = {
    city: 'Las Vegas',
    region: 'Nevada',
    country: 'United States',
    timezone: 'America/Los_Angeles',
    latitude: 36.17,
    longitude: -115.14,
  };
  const html = renderToStaticMarkup(
    createElement(StatusEditor, {
      initial: {
        configured: true,
        signedIn: true,
        editing: true,
        query: 'Vegas',
        results: [city],
        snapshot: { source: 'manual', location: city, updatedAt: null },
      },
    })
  );
  assert.match(html, /action="\/admin\/status" method="get"/);
  assert.match(html, /name="q"[^>]*value="Vegas"/);
  assert.match(
    html,
    /<form(?=[^>]*method="post")(?=[^>]*action="\/api\/admin\/status")/
  );
  assert.match(html, /name="action" value="save"/);
  assert.match(html, /name="city" value=/);
});
