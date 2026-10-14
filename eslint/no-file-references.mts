import type { Rule } from 'eslint';
import globals from 'globals';

const name = String.raw`[.@~\w<][@\w.()[\]<>-]*`;
const filenames = new RegExp(
  String.raw`(?<![\w])(?:${name}/)*${name}\.(?:[cm]?[jt]sx?|css|mdx?|jsonl?|ya?ml|sh|sql|env|txt|toml|woff2?|ttf|otf|svg|png|jpe?g|webp|gif|mp[34]|html?|xml|zip|wasm|lock|webmanifest|pdf|ico|icns|csv)\b|(?<![\w])\.(?:env(?:\.[\w-]+)*|gitignore|npmrc)\b|\b(?:Dockerfile|Makefile|LICENSE|README)\b|(?<![\w/:.-])(?:app|components|lib|scripts|tests|eslint|brand|content|data|public|docs)/(?:(?:${name}/)*${name})?`,
  'g'
);
const technologyNames = new Set(['next.js', 'node.js', 'react.js']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      filename:
        'Describe the behavior instead of naming {{filename}}. Reference symbols with TSDoc links when useful.',
    },
  },
  create(context) {
    return {
      Program() {
        const source = context.sourceCode;
        const symbols = new Set([
          ...Object.keys(globals.builtin),
          ...Object.keys(globals.browser),
          ...Object.keys(globals.node),
          ...source.scopeManager.scopes.flatMap((scope) =>
            scope.variables.map((variable) => variable.name)
          ),
        ]);
        for (const comment of source.getAllComments()) {
          const symbolLinks = [
            ...comment.value.matchAll(
              /\{@link(?:code|plain)?\s+([A-Za-z_$][\w$]*(?:[.#][A-Za-z_$][\w$]*)*)(?:\s+[^}]+)?\}/g
            ),
          ].filter(
            (link) =>
              symbols.has(link[1].split(/[.#]/)[0]) &&
              !/\.(?:[cm]?[jt]sx?|css|mdx?)$/.test(link[1])
          );
          for (const match of comment.value.matchAll(filenames)) {
            if (technologyNames.has(match[0].toLowerCase())) continue;
            if (
              symbolLinks.some((link) => {
                const start = link.index + link[0].indexOf(link[1]);
                return (
                  match.index >= start &&
                  match.index + match[0].length <= start + link[1].length
                );
              })
            )
              continue;
            const start = comment.range![0] + 2 + match.index;
            context.report({
              loc: {
                start: source.getLocFromIndex(start),
                end: source.getLocFromIndex(start + match[0].length),
              },
              messageId: 'filename',
              data: { filename: match[0] },
            });
          }
        }
      },
    };
  },
};

export default rule;
