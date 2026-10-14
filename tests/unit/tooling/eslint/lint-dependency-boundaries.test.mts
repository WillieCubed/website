import { RuleTester } from 'eslint';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import rule from '../../../../eslint/dependency-boundaries.mts';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});
const filename = (path: string) => resolve(path);

tester.run('site/dependency-boundaries', rule, {
  valid: [
    {
      filename: filename('app/example/page.tsx'),
      code: "import view from '@/components/example/View';",
    },
    {
      filename: filename('lib/atproto/responses/http.ts'),
      code: "import value from '../../site/identity';",
    },
    {
      filename: filename('tests/e2e/publishing/atproto/social.mts'),
      code: "import value from '../../../support/publishing/callback-proof.mts';",
    },
    {
      filename: filename('tests/support/publishing/fixture.mts'),
      code: "import value from '../../../lib/atproto/config';",
    },
    {
      filename: filename('lib/example/module.ts'),
      code: "import value from '@vendor/components';",
    },
    {
      filename: filename('scripts/atproto-social-capture.mts'),
      code: "import value from '../tests/e2e/publishing/atproto/capture/run.mts';",
    },
  ],
  invalid: [
    {
      filename: filename('lib/utils.ts'),
      code: 'export const value = 1;',
      errors: [{ messageId: 'domain' }],
    },
    {
      filename: filename('components/Shared.tsx'),
      code: 'export const value = 1;',
      errors: [{ messageId: 'domain' }],
    },
    {
      filename: filename('lib/atproto/responses/http.ts'),
      code: "import view from '../../../components/example/View';",
      errors: [{ messageId: 'application' }],
    },
    {
      filename: filename('lib/example/module.ts'),
      code: "export { value } from '@/tests/support/value';",
      errors: [{ messageId: 'application' }],
    },
    {
      filename: filename('components/example/View.tsx'),
      code: "await import('../../tests/e2e/publishing/atproto/social.mts');",
      errors: [{ messageId: 'application' }],
    },
    {
      filename: filename('tests/support/publishing/fixture.mts'),
      code: "import run from '../../e2e/publishing/atproto/social.mts';",
      errors: [{ messageId: 'support' }],
    },
    {
      filename: filename('tests/support/publishing/fixture.mts'),
      code: "import run from '../../../scripts/atproto-social-capture.mts';",
      errors: [{ messageId: 'support' }],
    },
    {
      filename: filename('tests/e2e/publishing/atproto/social.mts'),
      code: "import helper from '../../../../scripts/atproto-fixture-source.mts';",
      errors: [{ messageId: 'scenario' }],
    },
  ],
});
