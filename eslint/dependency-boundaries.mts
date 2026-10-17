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
      const target = localDependency(value, context.filename, root);
      if (target === undefined) return;
      const violation = dependencyViolation(source, target);
      if (violation) context.report({ node, messageId: violation });
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

function localDependency(value: string, filename: string, root: string) {
  if (value.startsWith('@/')) return value.slice(2);
  if (value.startsWith('.'))
    return relative(root, resolve(filename, '..', value))
      .split(sep)
      .join('/');
  return undefined;
}
function dependencyViolation(source: string, target: string) {
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
    return 'application';
  // Shared command helpers are not entrypoints, so test support may reuse them.
  if (
    within(source, 'tests/support') &&
    ['tests/e2e', 'tests/integration', 'tests/unit', 'scripts'].some((dir) =>
      within(target, dir)
    ) &&
    !within(target, 'scripts/shared')
  )
    return 'support';
}
