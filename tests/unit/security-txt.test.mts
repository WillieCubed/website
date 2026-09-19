import assert from 'node:assert/strict';
import test from 'node:test';

import { SECURITY_TXT_EXPIRES, buildSecurityTxt } from '@/lib/security-txt';
import { site } from '@/lib/site';

const DAY = 86_400_000;

test('security.txt carries the fields RFC 9116 requires', () => {
  const text = buildSecurityTxt();

  assert.match(text, /^Contact: mailto:\S+$/m);
  assert.match(text, /^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
});

test('security.txt contacts the site author', () => {
  assert.match(buildSecurityTxt(), new RegExp(`mailto:${site.author.email}`));
});

test('security.txt names its own location on the canonical origin', () => {
  assert.match(
    buildSecurityTxt(),
    new RegExp(`^Canonical: ${site.origin}/.well-known/security.txt$`, 'm')
  );
});

test('security.txt does not lapse within 30 days; renew SECURITY_TXT_EXPIRES before this fails', () => {
  const daysLeft = (Date.parse(SECURITY_TXT_EXPIRES) - Date.now()) / DAY;

  assert.ok(
    daysLeft > 30,
    `security.txt expires in ${Math.floor(daysLeft)} days; renew SECURITY_TXT_EXPIRES`
  );
});

test('security.txt expires within a year, as RFC 9116 recommends', () => {
  const daysLeft = (Date.parse(SECURITY_TXT_EXPIRES) - Date.now()) / DAY;

  assert.ok(daysLeft <= 366, 'RFC 9116 recommends less than a year');
});
