import type { Rule } from 'eslint';
import type { Node } from 'estree-jsx';

/**
 * Reports a JSX `<a>` whose href is written out as an in-site address, so
 * the link goes through SiteLink instead and gets the hover card and one
 * navigation behaviour.
 *
 * Only hrefs spelled in the source are checked: a string or template literal
 * starting with `/`, `?`, or the canonical origin, and a template literal
 * that opens with `site.origin`. A computed href (a variable, a prop, a
 * helper call) is out of reach of a syntax rule.
 */

// The origin as it would be spelled in source. The runtime identity reads the
// deployment's origin from the environment, but this rule looks at source
// text, where the only spelling that means "this site" is the canonical one.
const CANONICAL_ORIGIN = 'https://willie.page';

function isInternalText(text: string): boolean {
  if (text.startsWith('?')) return true;
  // `//host` is protocol-relative, so it leaves the site.
  if (text.startsWith('/')) return !text.startsWith('//');
  if (!text.startsWith(CANONICAL_ORIGIN)) return false;
  // `https://willie.page.evil.com` shares the spelling but not the host.
  const next = text.charAt(CANONICAL_ORIGIN.length);
  return next === '' || '/?#'.includes(next);
}

function isSiteOrigin(node: Node | null | undefined): boolean {
  return (
    node?.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'site' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'origin'
  );
}

function isInternalHref(node: Node | null | undefined): boolean {
  if (!node) return false;
  if (node.type === 'JSXExpressionContainer') {
    return isInternalHref(node.expression);
  }
  if (node.type === 'Literal') {
    return typeof node.value === 'string' && isInternalText(node.value);
  }
  if (node.type === 'TemplateLiteral') {
    const head = node.quasis[0]?.value.cooked ?? '';
    if (head === '' && isSiteOrigin(node.expressions[0])) return true;
    return isInternalText(head);
  }
  return isSiteOrigin(node);
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require SiteLink instead of a raw <a> for links to pages on this site.',
    },
    messages: {
      raw: 'Use SiteLink for in-site links so they get the hover card. For a route handler, a download, or a hidden microformat anchor, disable this rule on the line and say why.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.type !== 'JSXOpeningElement') return;
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'a') {
          return;
        }
        const href = node.attributes.find(
          (attribute) =>
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'href'
        );
        if (href?.type === 'JSXAttribute' && isInternalHref(href.value)) {
          context.report({ node: href, messageId: 'raw' });
        }
      },
    };
  },
};

export default rule;
