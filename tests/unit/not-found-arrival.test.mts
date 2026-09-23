import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_REFERRER, describeArrival } from '@/components/not-found/arrival';

const host = 'willie.page';

test('names the outside site a visitor followed a link from', () => {
  assert.equal(
    describeArrival({
      referrer: 'https://www.example.com/post',
      host,
      loadedHere: true,
    }),
    'followed a link from example.com'
  );
});

test('names the page on this site a visitor followed a link on', () => {
  assert.equal(
    describeArrival({
      referrer: 'https://willie.page/writings?tag=transit',
      host,
      loadedHere: true,
    }),
    'followed a link on /writings'
  );
});

test('does not claim a visitor typed the address when no referrer came', () => {
  const said = describeArrival({ referrer: '', host, loadedHere: true });
  assert.equal(said, NO_REFERRER);
  assert.doesNotMatch(said, /typed/);
});

test('reads a malformed referrer the same as none', () => {
  assert.equal(
    describeArrival({ referrer: 'not a url', host, loadedHere: true }),
    NO_REFERRER
  );
});

test('ignores a stale referrer after in-site navigation', () => {
  assert.equal(
    describeArrival({
      referrer: 'https://www.example.com/post',
      host,
      loadedHere: false,
    }),
    'followed a link on this site'
  );
});
