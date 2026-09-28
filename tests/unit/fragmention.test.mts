import assert from 'node:assert/strict';
import test from 'node:test';

import { findWords, fragmentionWords } from '@/lib/fragmention';

test('a double hash names the words, with + as a space', () => {
  assert.equal(fragmentionWords('##some+words'), 'some words');
  assert.equal(
    fragmentionWords('##Boys%20Go+to%20Jupiter'),
    'Boys Go to Jupiter'
  );
  assert.equal(fragmentionWords('##caf%C3%A9'), 'café');
});

test('an ordinary hash, an empty one, or no hash is not a fragmention', () => {
  assert.equal(fragmentionWords('#outcomes'), null);
  assert.equal(fragmentionWords(''), null);
  assert.equal(fragmentionWords('##'), null);
  assert.equal(fragmentionWords('##+++'), null);
});

test('a malformed escape still names the words as typed', () => {
  assert.equal(fragmentionWords('##100%+sure'), '100% sure');
});

test('the words match regardless of case', () => {
  const text = 'The first leg keeps it simple.';
  assert.deepEqual(findWords(text, 'FIRST LEG'), [4, 13]);
  assert.equal(text.slice(4, 13), 'first leg');
});

test('the words match across the line breaks and runs of spaces in prose', () => {
  const text = 'independent publishing on\nwillie.page.  An isolated copy';
  const found = findWords(text, 'on willie.page. an');
  assert.ok(found);
  assert.equal(text.slice(...found), 'on\nwillie.page.  An');
});

test('punctuation in the words is matched literally', () => {
  assert.equal(findWords('Staycation (NY) and more', 'n.'), null);
  assert.deepEqual(findWords('Staycation (NY) and more', '(ny)'), [11, 15]);
  assert.deepEqual(findWords('a+b and c', 'a+b'), [0, 3]);
});

test('text without the words, or no words, finds nothing', () => {
  assert.equal(findWords('Dallas, Plano, Denton', 'Austin'), null);
  assert.equal(findWords('Dallas', ''), null);
});

test('the first occurrence wins', () => {
  assert.deepEqual(findWords('tea for two, tea for three', 'tea for'), [0, 7]);
});
