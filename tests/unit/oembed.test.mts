import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOEmbedResponse } from '@/lib/indieweb/oembed';
import { site } from '@/lib/site';

test('buildOEmbedResponse returns a rich provider payload', () => {
  const response = buildOEmbedResponse({
    targetUrl: `${site.origin}/writings/example`,
    title: 'Example',
    description: 'An example writing.',
    thumbnailUrl: `${site.origin}/assets/headshot.jpg`,
  });

  assert.equal(response.version, '1.0');
  assert.equal(response.type, 'rich');
  assert.equal(response.provider_url, site.origin);
  assert.match(response.html, /Example/);
  assert.match(response.html, /An example writing\./);
});
