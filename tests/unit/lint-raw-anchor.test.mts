import { RuleTester } from 'eslint';
import { describe, it } from 'node:test';

import rule from '../../eslint/no-raw-internal-anchor.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const raw = [{ messageId: 'raw' }];

tester.run('site/no-raw-internal-anchor', rule, {
  valid: [
    '<a href="https://hypertext.studio">Hypertext Studio</a>',
    '<a href="https://willie.page.evil.com/">look-alike</a>',
    '<a href="//evil.com">protocol-relative</a>',
    '<a href="#top">hash</a>',
    '<a href="mailto:hello@willie.page">email</a>',
    '<a href={item.href}>computed</a>',
    '<a href={absoluteUrl("/writings")}>helper</a>',
    '<a href={`${other.origin}/`}>another origin</a>',
    '<a>no href</a>',
    '<SiteLink href="/writings">Writings</SiteLink>',
  ],
  invalid: [
    { code: '<a href="/writings">Writings</a>', errors: raw },
    { code: '<a href={"/writings"}>Writings</a>', errors: raw },
    { code: '<a href="?detail=lvbt">LVBT</a>', errors: raw },
    { code: '<a href={`?detail=${id}`}>LVBT</a>', errors: raw },
    { code: '<a href={`/writings/${slug}`}>Post</a>', errors: raw },
    { code: '<a href="https://willie.page">Home</a>', errors: raw },
    { code: '<a href="https://willie.page/brand">Brand</a>', errors: raw },
    { code: '<a href={`${site.origin}/`}>Home</a>', errors: raw },
    { code: '<a href={site.origin}>Home</a>', errors: raw },
  ],
});
