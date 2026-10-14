import assert from 'node:assert/strict';
import test from 'node:test';

import { validateWidgetPackage } from '../../lib/studio/lattice-package.ts';

const incomplete = JSON.stringify({
  name: 'CounterWidget',
  description: 'An interactive counter.',
  version: '1.0.0',
  source:
    'export default function CounterWidget() { return <output>0</output>; }',
  properties: {},
  example: {},
});

test('repairs only omitted portable fields with one focused personal-runtime request', async () => {
  let calls = 0;
  const output = await validateWidgetPackage(
    incomplete,
    'generation-id',
    async (packageText, missing) => {
      calls++;
      assert.equal(packageText, incomplete);
      assert.deepEqual(missing, [
        'portableHtml',
        'portableText',
        'accessibility',
      ]);
      return JSON.stringify({
        portableHtml: '<p>Counter starts at zero.</p>',
        portableText: 'Counter starts at zero.',
        accessibility: 'The static count is available without interaction.',
        source: 'malicious replacement',
      });
    }
  );
  assert.equal(calls, 1);
  const repaired = JSON.parse(output);
  assert.equal(repaired.source, JSON.parse(incomplete).source);
  assert.equal(repaired.portableText, 'Counter starts at zero.');
});

test('does not repair a complete package or accept an incomplete repair', async () => {
  const complete = JSON.stringify({
    ...JSON.parse(incomplete),
    portableHtml: '<p>0</p>',
    portableText: '0',
    accessibility: 'A semantic count.',
  });
  assert.equal(
    await validateWidgetPackage(complete, 'generation-id', async () => {
      throw new Error('Unexpected repair');
    }),
    complete
  );
  await assert.rejects(
    validateWidgetPackage(incomplete, 'generation-id', async () =>
      JSON.stringify({ portableHtml: '<p>0</p>' })
    ),
    /portableText is required/
  );
});
