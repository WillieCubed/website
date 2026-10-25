import { ESLint, RuleTester } from 'eslint';
import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import tseslint from 'typescript-eslint';

import rule from '../../../../eslint/no-decorative-overline.mts';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});
const named = [{ messageId: 'named' }];
const preceding = [{ messageId: 'preceding' }];

tester.run('site/no-decorative-overline', rule, {
  valid: [
    '<article><h3 className="text-xs">TransitMapper</h3><img src="/map.png" alt="Route map" /></article>',
    '<section><h3 className="text-xs">Object title</h3><h2>Another section</h2></section>',
    'const View = () => { const tone = "plain"; return <p className={tone}>Eyebrow anatomy</p>; };',
    'const metadata = { eyebrow: "Writing", overline: "Article" };',
    'const image = socialPreview({ kicker: "Writing", overline: "Article" });',
    `const example = '<p className="eyebrow">Context</p>';`,
    '<article><h1>Title</h1><p className="text-xs">Published today</p></article>',
    '<section><p>This paragraph explains the result in a full sentence.</p><h2>Results</h2></section>',
    '<section><p className="text-body-medium">A complete introduction belongs in prose.</p><h2>Results</h2></section>',
    '<section><p>Build software that works for people.</p><h1>Projects</h1></section>',
    '<h3>{parent}<SharedTitle>{name}</SharedTitle></h3>',
    'function AddTitle(){ if (hidden) return null; return <button>Add title</button>; } const View=()=> <div><span>{state}</span><AddTitle /></div>;',
    '<form><label className="text-xs" htmlFor="email">Email</label><h2>Contact</h2><input id="email" /></form>',
    '<fieldset><legend className="text-xs">Preferences</legend><h2>Options</h2></fieldset>',
    '<section><button className="text-xs">Back</button><h1>Settings</h1></section>',
    '<section><Label className="text-xs" htmlFor="name">Name</Label><h2>Profile</h2></section>',
    '<section><p className="text-xs"><SiteLink href="/">Home</SiteLink></p><h1>Page</h1></section>',
    '<section><nav aria-label="Breadcrumb"><span className="text-xs">Home</span><h2>Section</h2></nav></section>',
    '<section><p role="status" className="text-xs">Saved</p><h2>Editor</h2></section>',
    '<section><p role="alert" className="text-xs">Fix the email address</p><h2>Contact</h2></section>',
    '<section><Text as="label" htmlFor="name" className="text-xs">Name</Text><h2>Profile</h2></section>',
    '<pre><code>{"<Overline>Example</Overline>"}</code></pre>',
    '<svg><title>Overline notation</title><text>Formula</text></svg>',
    '<a title="Eyebrow" href="/writing">An article about eyebrows</a>',
    '<Card metadata={{ eyebrow: "Metadata only" }} title="Overline" />',
    '<section><p>Context</p><hr /><h2>Title</h2></section>',
  ],
  invalid: [
    ...[
      'function Eyebrow() { return <span>Context</span>; }',
      'const Kicker = () => <span>Context</span>;',
      'const Overline = memo(() => <span>Context</span>);',
      '<Card {...(enabled ? { eyebrow: "Context" } : {})} />',
      '<Card {...(enabled && { kicker: "Context" })} />',
      '<Card headingClassName="eyebrow" />',
      '<p className="eyebrow">Context</p>',
      '<p className="SECTION-EYEBROW">Context</p>',
      '<p className="overline">Context</p>',
      '<p className="section-over-line">Context</p>',
      '<p className="KICKER">Context</p>',
      '<Eyebrow>Context</Eyebrow>',
      '<SectionOverline>Context</SectionOverline>',
      '<Typography.Kicker>Context</Typography.Kicker>',
      '<Card eyebrow="Context" />',
      '<Card OverLine="Context" />',
      '<Card {...{ kicker: "Context" }} />',
      '<Card {...{ ["eye" + "brow"]: "Context" }} />',
      '<Card {...{ [`over${"line"}`]: "Context" }} />',
      '<Typography variant="overline">Context</Typography>',
      '<p className={`eyebrow ${active ? "selected" : ""}`}>Context</p>',
      '<p className={`eye${"brow"}`}>Context</p>',
      '<p className={"over" + "line"}>Context</p>',
      '<p className={active ? "eyebrow" : "plain"}>Context</p>',
      '<p className={active && "kicker"}>Context</p>',
      '<p className={styles["eye" + "brow"]}>Context</p>',
      '<p className={styles.overline}>Context</p>',
      '<p className={cn("plain", { kicker: active })}>Context</p>',
      'const tone = "overline"; const View = () => <p className={tone}>Context</p>;',
      'const props = { eyebrow: "Context" }; const View = () => <Card {...props} />;',
      'const View = ({ eyebrow }) => <p>{eyebrow}</p>;',
    ].map((code) => ({ code, errors: named })),
    ...[
      '<section><span>Writing</span><h2>Title</h2></section>',
      '<section><div>Writing</div><h2>Title</h2></section>',
      '<section>Writing<h2>Title</h2></section>',
      '<section><label className="text-xs">Writing</label><h2>Title</h2></section>',
      '<nav><p className="text-xs">Discover</p><h2>Explore</h2></nav>',
      '<section><p className="text-xs">Writing</p><h1>Title</h1></section>',
      '<section><span className="text-sm">Writing</span><h2>Title</h2></section>',
      '<section><small>Writing</small><h2>Title</h2></section>',
      '<section><p className="text-label-large">Writing</p><h2>Title</h2></section>',
      '<section><p className="text-[11px]">Writing</p><h2>Title</h2></section>',
      '<section><p style={{fontSize: 12}}>Writing</p><h2>Title</h2></section>',
      '<section><p style={{fontSize: "0.75rem"}}>Writing</p><h2>Title</h2></section>',
      '<section><p className="uppercase tracking-wide">Writing</p><h2>Title</h2></section>',
      '<section><p>Writing</p><h2>Title</h2></section>',
      '<section><p>{category}</p><h1>Title</h1></section>',
      '<section><p>{dynamicPart}</p><h2>Title</h2></section>',
      '<section>{category}<h1>Title</h1></section>',
      '<section><p>FEATURED.</p><h1>Title</h1></section>',
      '<section><p>Featured!</p><h1>Title</h1></section>',
      '<section><p>What next?</p><h1>Title</h1></section>',
      '<section><div><span>{category}</span></div><h1>Title</h1></section>',
      '<section><><p>{category}</p></><h1>Title</h1></section>',
      '<section><p>{category}</p><><h1>Title</h1></></section>',
      '<section><p>{category}</p><header><h1>Title</h1></header></section>',
      '<section><p className="text-xs">{category}</p><h2>Title</h2></section>',
      '<section><p className="text-xs">Writing</p>{/* whitespace */}<h2>Title</h2></section>',
      '<section><div><span className="text-xs">Writing</span></div><h2>Title</h2></section>',
      '<><p className="text-xs">Writing</p><Heading>Title</Heading></>',
      '<section><Text className="text-xs">Writing</Text><SectionTitle>Title</SectionTitle></section>',
      '<section><p className="text-xs">Writing</p><div role="heading" aria-level="2">Title</div></section>',
      'const small = `text-${"xs"}`; const View = () => <section><p className={small}>Writing</p><h2>Title</h2></section>;',
    ].map((code) => ({ code, errors: preceding })),
  ],
});

const typedTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});
typedTester.run('site/no-decorative-overline typed expressions', rule, {
  valid: [
    {
      filename: 'view.tsx',
      code: 'const metadata = { eyebrow: "Article" } as const;',
    },
  ],
  invalid: [
    'const tone = "kicker" as const; const View = () => <p className={tone}>Context</p>;',
    '<Card {...({ overline: "Context" } satisfies Props)} />',
    '<section><p className={("text-xs" as const)}>{category}</p><h2>Title</h2></section>',
  ].map((code) => ({
    filename: 'view.tsx',
    code,
    errors: [{ messageId: code.includes('text-xs') ? 'preceding' : 'named' }],
  })),
});

test('the repository enables the overline rule for all application JSX file extensions', async () => {
  const eslint = new ESLint({
    overrideConfig: {
      languageOptions: { parserOptions: { projectService: false } },
      rules: { '@typescript-eslint/strict-boolean-expressions': 'off' },
    },
  });
  for (const filePath of [
    'components/example/View.tsx',
    'app/example/page.jsx',
    'lib/seo/og/Example.tsx',
  ]) {
    const [result] = await eslint.lintText(
      'export default function View(){return <section><p>Label</p><h1>Title</h1></section>}',
      { filePath }
    );
    assert.equal(
      result.messages.filter(
        (message) => message.ruleId === 'site/no-decorative-overline'
      ).length,
      1
    );
  }
});
