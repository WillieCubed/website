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
      filename: filename('tests/support/studio/run.mts'),
      code: "import { isMain } from '../../../scripts/shared/command.mts';",
    },
    {
      filename: filename('tests/support/studio/fixture.mts'),
      code: "import value from '../../../lib/atproto/config';",
    },
    {
      filename: filename('lib/example/module.ts'),
      code: "import value from '@vendor/components';",
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
      code: "await import('../../tests/e2e/site/music/capture.mts');",
      errors: [{ messageId: 'application' }],
    },
    {
      filename: filename('tests/support/studio/fixture.mts'),
      code: "import run from '../../e2e/site/music/capture.mts';",
      errors: [{ messageId: 'support' }],
    },
    {
      filename: filename('tests/support/studio/fixture.mts'),
      code: "import run from '../../../scripts/atproto/sync.mts';",
      errors: [{ messageId: 'support' }],
    },
  ],
});
