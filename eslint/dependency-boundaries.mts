import type { JSSyntaxElement, Rule } from 'eslint';
import type { Node } from 'estree-jsx';
import { relative, resolve, sep } from 'node:path';

const within = (path: string, directory: string) =>
  path.startsWith(`${directory}/`);

/** Check resolved local paths so aliases and deeply nested imports obey the same rules. */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      domain:
        'Place this module under the domain that owns it, rather than at the components or lib root.',
      application:
        'Application modules cannot depend on command entrypoints, tests, or test support; libraries also cannot depend on UI.',
      support:
        'Test support cannot depend on test scenarios or command entrypoints. Put reusable helpers in tests/support.',
      scenario:
        'Publishing tests must import application modules or tests/support directly, rather than legacy script entrypoints.',
    },
  },
  create(context) {
    const root = context.cwd;
    const source = relative(root, context.filename).split(sep).join('/');
    const segments = source.split('/');
    if (segments.length === 2 && ['components', 'lib'].includes(segments[0])) {
      return {
        Program(node) {
          context.report({ node, messageId: 'domain' });
        },
      };
    }
    function check(node: JSSyntaxElement, specifier: Node | null | undefined) {
      const value = specifier?.type === 'Literal' ? specifier.value : undefined;
      if (typeof value !== 'string') return;
      let target;
      if (value.startsWith('@/')) target = value.slice(2);
      else if (value.startsWith('.')) {
        target = relative(root, resolve(context.filename, '..', value))
          .split(sep)
          .join('/');
      } else return;

      const application = ['lib', 'app', 'components'].some((dir) =>
        within(source, dir)
      );
      const infrastructure = ['tests', 'scripts'].some((dir) =>
        within(target, dir)
      );
      if (
        application &&
        (infrastructure ||
          (within(source, 'lib') &&
            ['app', 'components'].some((dir) => within(target, dir))))
      )
        context.report({ node, messageId: 'application' });
      else if (
        within(source, 'tests/support') &&
        ['tests/e2e', 'tests/integration', 'tests/unit', 'scripts'].some(
          (dir) => within(target, dir)
        )
      )
        context.report({ node, messageId: 'support' });
      else if (
        within(source, 'tests/e2e/publishing') &&
        within(target, 'scripts')
      )
        context.report({ node, messageId: 'scenario' });
    }
    return {
      ImportDeclaration(node) {
        check(node, node.source);
      },
      ExportNamedDeclaration(node) {
        check(node, node.source);
      },
      ExportAllDeclaration(node) {
        check(node, node.source);
      },
      ImportExpression(node) {
        check(node, node.source);
      },
    };
  },
};

export default rule;
