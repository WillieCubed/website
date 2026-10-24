import type { Rule } from 'eslint';
import type { JSXElement, Node } from 'estree-jsx';

type ParentNode = Node & { parent?: ParentNode | null };
type ChildNode = JSXElement['children'][number];
type Context = Rule.RuleContext;

const banned = /eyebrow|overline|kicker/i;
const presentation =
  /(?:class(?:name)?|variant|typography|textstyle|size|style)$/i;
const textElements =
  /^(?:p|span|small|div|time|label|Label|FormLabel|legend|Text|Typography)$/;
const phrasing = /^(?:p|span|small|div|time|b|strong|em|i)$/;
const controls =
  /^(?:button|input|select|textarea|option|summary|a|Button|IconButton|SiteLink|Link)$/;
const controlRoles = new Set([
  'button',
  'link',
  'tab',
  'checkbox',
  'radio',
  'switch',
  'combobox',
  'menuitem',
  'option',
  'status',
  'alert',
]);

function named(text: string) {
  return banned.test(text.replace(/[\s_-]/g, ''));
}
function tag(node: Node): string {
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression')
    return `${tag(node.object)}.${tag(node.property)}`;
  return '';
}
function initializer(node: Node, context: Context): Node | undefined {
  if (node.type !== 'Identifier') return undefined;
  let scope: ReturnType<typeof context.sourceCode.getScope> | null =
    context.sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(node.name);
    if (variable) {
      const definition = variable.defs.find(
        (entry) =>
          entry.type === 'Variable' &&
          entry.parent?.type === 'VariableDeclaration' &&
          entry.parent.kind === 'const'
      );
      return definition?.node.type === 'VariableDeclarator'
        ? (definition.node.init ?? undefined)
        : undefined;
    }
    scope = scope.upper;
  }
  return undefined;
}
function unwrap(node: Node): Node {
  if (
    /^TS(?:As|Satisfies|NonNull|TypeAssertion)Expression$/.test(node.type) &&
    'expression' in node
  )
    return (node as Node & { expression: Node }).expression;
  return node;
}
function primitiveText(node: Node): string | undefined {
  if (node.type !== 'Literal') return undefined;
  return typeof node.value === 'string' || typeof node.value === 'number'
    ? String(node.value)
    : undefined;
}
function binaryText(
  node: Node,
  context: Context,
  seen: Set<Node>
): string | undefined {
  if (node.type !== 'BinaryExpression' || node.operator !== '+')
    return undefined;
  const left = staticText(node.left, context, seen);
  const right = staticText(node.right, context, seen);
  return left === undefined || right === undefined ? undefined : left + right;
}
function templateText(
  node: Node,
  context: Context,
  seen: Set<Node>
): string | undefined {
  if (node.type !== 'TemplateLiteral') return undefined;
  const values = node.expressions.map((expression) =>
    staticText(expression, context, seen)
  );
  if (values.some((value) => value === undefined)) return undefined;
  return node.quasis
    .map(
      (quasi, index) =>
        (quasi.value.cooked ?? quasi.value.raw) + (values[index] ?? '')
    )
    .join('');
}
function staticText(
  node: Node | null | undefined,
  context: Context,
  seen = new Set<Node>()
): string | undefined {
  if (!node || seen.has(node)) return undefined;
  seen.add(node);
  const expression = unwrap(node);
  if (expression !== node) return staticText(expression, context, seen);
  switch (node.type) {
    case 'Literal':
      return primitiveText(node);
    case 'JSXExpressionContainer':
      return staticText(node.expression, context, seen);
    case 'Identifier':
      return staticText(initializer(node, context), context, seen);
    case 'BinaryExpression':
      return binaryText(node, context, seen);
    case 'TemplateLiteral':
      return templateText(node, context, seen);
    default:
      return undefined;
  }
}
function objectNames(
  node: Node | undefined,
  context: Context,
  seen = new Set<Node>()
): string[] {
  if (!node || seen.has(node)) return [];
  seen.add(node);
  const expression = unwrap(node);
  if (expression !== node) return objectNames(expression, context, seen);
  if (node.type === 'Identifier')
    return objectNames(initializer(node, context), context, seen);
  if (node.type === 'ConditionalExpression')
    return [
      ...objectNames(node.consequent, context, seen),
      ...objectNames(node.alternate, context, seen),
    ];
  if (node.type === 'LogicalExpression')
    return [
      ...objectNames(node.left, context, seen),
      ...objectNames(node.right, context, seen),
    ];
  if (node.type !== 'ObjectExpression') return [];
  return node.properties.flatMap((property) => {
    if (property.type === 'SpreadElement')
      return objectNames(property.argument, context, seen);
    return [
      property.computed
        ? (staticText(property.key, context) ?? '')
        : tagOrIdentifier(property.key),
    ];
  });
}
function tagOrIdentifier(node: Node): string {
  if (node.type === 'Identifier' || node.type === 'JSXIdentifier')
    return node.name;
  if (node.type === 'Literal') return String(node.value);
  return '';
}
function branchTokens(node: Node, context: Context, seen: Set<Node>): string[] {
  switch (node.type) {
    case 'ConditionalExpression':
      return [
        ...valueTokens(node.consequent, context, seen),
        ...valueTokens(node.alternate, context, seen),
      ];
    case 'LogicalExpression':
    case 'BinaryExpression':
      return [
        ...valueTokens(node.left, context, seen),
        ...valueTokens(node.right, context, seen),
      ];
    case 'ArrayExpression':
      return node.elements.flatMap((element) =>
        valueTokens(element, context, seen)
      );
    case 'ObjectExpression':
      return objectNames(node, context);
    case 'ChainExpression':
      return valueTokens(node.expression, context, seen);
    default:
      return [];
  }
}
function syntaxTokens(node: Node, context: Context, seen: Set<Node>): string[] {
  switch (node.type) {
    case 'Identifier':
      return [
        node.name,
        ...valueTokens(initializer(node, context), context, seen),
      ];
    case 'JSXExpressionContainer':
      return valueTokens(node.expression, context, seen);
    case 'MemberExpression':
      return node.computed
        ? valueTokens(node.property, context, seen)
        : [tagOrIdentifier(node.property)];
    case 'TemplateLiteral':
      return [
        ...node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw),
        ...node.expressions.flatMap((expression) =>
          valueTokens(expression, context, seen)
        ),
      ];
    case 'CallExpression':
      return node.arguments.flatMap((argument) =>
        valueTokens(argument, context, seen)
      );
    default:
      return branchTokens(node, context, seen);
  }
}
function valueTokens(
  node: Node | null | undefined,
  context: Context,
  seen = new Set<Node>()
): string[] {
  if (!node || seen.has(node)) return [];
  seen.add(node);
  const expression = unwrap(node);
  if (expression !== node) return valueTokens(expression, context, seen);
  return [
    staticText(node, context) ?? '',
    ...syntaxTokens(node, context, seen),
  ];
}
function renderedReferences(node: Node, context: Context): string[] {
  const expression = unwrap(node);
  if (expression !== node) return renderedReferences(expression, context);
  switch (node.type) {
    case 'Identifier':
      return [node.name];
    case 'MemberExpression':
      return [
        node.computed
          ? (staticText(node.property, context) ?? '')
          : tagOrIdentifier(node.property),
      ];
    case 'LogicalExpression':
      return [
        ...renderedReferences(node.left, context),
        ...renderedReferences(node.right, context),
      ];
    case 'ConditionalExpression':
      return [
        ...renderedReferences(node.consequent, context),
        ...renderedReferences(node.alternate, context),
      ];
    default:
      return [];
  }
}
function attribute(node: JSXElement, name: string) {
  return node.openingElement.attributes.find(
    (entry) =>
      entry.type === 'JSXAttribute' &&
      entry.name.type === 'JSXIdentifier' &&
      entry.name.name === name
  );
}
function attributeText(node: JSXElement, name: string, context: Context) {
  const entry = attribute(node, name);
  return entry?.type === 'JSXAttribute'
    ? staticText(entry.value, context)
    : undefined;
}
function explicitName(node: JSXElement, context: Context): boolean {
  if (named(tag(node.openingElement.name))) return true;
  return node.openingElement.attributes.some((entry) => {
    if (entry.type === 'JSXSpreadAttribute')
      return objectNames(entry.argument, context).some(named);
    const name = tag(entry.name);
    if (named(name)) return true;
    return (
      presentation.test(name) && valueTokens(entry.value, context).some(named)
    );
  });
}
function significant(node: Node | ChildNode): boolean {
  if (node.type === 'JSXText') return node.value.trim().length > 0;
  return (
    node.type !== 'JSXExpressionContainer' ||
    node.expression.type !== 'JSXEmptyExpression'
  );
}
function functionReturns(node: Node, context: Context): Node[] {
  if (node.type === 'ReturnStatement')
    return node.argument ? [node.argument] : [];
  if (/Function|Class/.test(node.type)) return [];
  const fields = node as unknown as Record<string, Node | Node[] | undefined>;
  return (context.sourceCode.visitorKeys[node.type] ?? []).flatMap((key) => {
    const children = fields[key];
    return (Array.isArray(children) ? children : [children]).flatMap((child) =>
      child ? functionReturns(child, context) : []
    );
  });
}
function controlReturn(node: Node, context: Context): boolean {
  if (node.type === 'Literal' && node.value === null) return true;
  return (
    node.type === 'JSXElement' &&
    (controls.test(tag(node.openingElement.name)) ||
      controlRoles.has(attributeText(node, 'role', context) ?? ''))
  );
}
function localControl(node: JSXElement, context: Context): boolean {
  const name = tag(node.openingElement.name);
  let scope: ReturnType<typeof context.sourceCode.getScope> | null =
    context.sourceCode.getScope(node);
  while (scope) {
    const variable = scope.set.get(name);
    if (variable) {
      const definition = variable.defs.find(
        (entry) => entry.node.type === 'FunctionDeclaration'
      );
      if (definition?.node.type !== 'FunctionDeclaration') return false;
      const returns = functionReturns(definition.node.body, context);
      return (
        returns.some((value) => value.type === 'JSXElement') &&
        returns.every((value) => controlReturn(value, context))
      );
    }
    scope = scope.upper;
  }
  return false;
}
function heading(
  node: Node | ChildNode | undefined,
  context: Context
): boolean {
  if (node?.type === 'JSXFragment')
    return heading(node.children.find(significant), context);
  if (node?.type !== 'JSXElement') return false;
  const name = tag(node.openingElement.name);
  if (/^(?:header|Fragment|React\.Fragment)$/.test(name))
    return heading(node.children.find(significant), context);
  if (localControl(node, context)) return false;
  return (
    /^h[1-6]$/.test(name) ||
    /^(?:Heading|\w+Heading|Title|\w+Title)$/.test(name) ||
    attributeText(node, 'role', context) === 'heading'
  );
}
function controlLabel(node: JSXElement, context: Context): boolean {
  const name = tag(node.openingElement.name);
  if (
    /^(?:label|Label|FormLabel)$/.test(name) ||
    attributeText(node, 'as', context) === 'label'
  )
    return (
      attribute(node, 'htmlFor') !== undefined ||
      node.children.some((child) => hasControl(child, context))
    );
  const parent = (node as ParentNode).parent;
  return (
    name === 'legend' &&
    parent?.type === 'JSXElement' &&
    tag(parent.openingElement.name) === 'fieldset'
  );
}
function hasControl(node: Node | ChildNode, context: Context): boolean {
  if (node.type !== 'JSXElement') return false;
  const name = tag(node.openingElement.name);
  if (
    controls.test(name) ||
    controlRoles.has(attributeText(node, 'role', context) ?? '')
  )
    return true;
  if (controlLabel(node, context)) return true;
  return node.children.some((child) => hasControl(child, context));
}
function protectedContext(node: ParentNode, context: Context): boolean {
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'JSXElement') {
      const name = tag(parent.openingElement.name);
      if (
        /^(?:pre|code|kbd|samp|h[1-6])$/.test(name) ||
        ((name === 'nav' ||
          attributeText(parent, 'role', context) === 'navigation') &&
          /breadcrumb/i.test(
            attributeText(parent, 'aria-label', context) ?? ''
          ))
      )
        return true;
    }
    parent = parent.parent;
  }
  return false;
}
function textChildren(node: Node | ChildNode) {
  if (node.type === 'JSXFragment') return node.children;
  if (node.type !== 'JSXElement') return undefined;
  const name = tag(node.openingElement.name);
  return textElements.test(name) ||
    phrasing.test(name) ||
    /^(?:Fragment|React\.Fragment)$/.test(name)
    ? node.children
    : undefined;
}
function standaloneText(
  node: Node | ChildNode,
  context: Context
): string | undefined {
  if (node.type === 'JSXText') return node.value.trim();
  if (node.type === 'JSXExpressionContainer')
    return (
      staticText(node.expression, context) ??
      (node.expression.type === 'JSXEmptyExpression' ? '' : '\uFFFC')
    );
  const children = textChildren(node);
  if (!children) return undefined;
  const parts = children
    .filter(significant)
    .map((child) => standaloneText(child, context));
  if (parts.some((part) => part === undefined)) return undefined;
  return parts.join(' ').trim();
}
function smallStyle(node: JSXElement, context: Context): boolean {
  const style = attribute(node, 'style');
  if (
    style?.type !== 'JSXAttribute' ||
    style.value?.type !== 'JSXExpressionContainer' ||
    style.value.expression.type !== 'ObjectExpression'
  )
    return false;
  return style.value.expression.properties.some((property) => {
    if (
      property.type !== 'Property' ||
      tagOrIdentifier(property.key) !== 'fontSize'
    )
      return false;
    const value = staticText(property.value, context) ?? '';
    return (
      /^(?:[0-9]|1[0-4])(?:px)?$/.test(value) ||
      /^(?:0?\.[0-8]\d*)(?:rem|em)$/.test(value)
    );
  });
}
function shortLabel(text: string): boolean {
  if (text.includes('\uFFFC')) return true;
  const words = text.split(/\s+/).length;
  const prose = words >= 6 && /[.!?]$/.test(text) && /[a-z]/.test(text);
  return text.length <= 80 && words <= 8 && !prose;
}
function small(node: Node, context: Context): boolean {
  if (node.type !== 'JSXElement') return false;
  if (tag(node.openingElement.name) === 'small') return true;
  const classes = attribute(node, 'className');
  if (
    classes?.type === 'JSXAttribute' &&
    valueTokens(classes.value, context).some((value) =>
      /(?:^|[\s:])(?:text-(?:xs|sm|caption|body-small|label-(?:small|medium|large)|\[(?:1[0-4]|[0-9])px\])|uppercase|tracking-(?:wide|wider|widest))(?:\s|$)/.test(
        value
      )
    )
  )
    return true;
  return smallStyle(node, context);
}
function labelBeforeHeading(node: ParentNode, context: Context): boolean {
  const parent = node.parent;
  if (parent?.type !== 'JSXElement' && parent?.type !== 'JSXFragment')
    return false;
  if (protectedContext(node, context) || hasControl(node, context))
    return false;
  const siblings = parent.children.filter(significant);
  if (
    !heading(
      siblings[siblings.findIndex((child) => child === node) + 1]!,
      context
    )
  )
    return false;
  const text = standaloneText(node, context);
  if (!text) return false;
  return small(node, context) || shortLabel(text);
}

function definitionBinding(
  node: ParentNode | null | undefined
): Node | undefined {
  if (!node) return undefined;
  if (node.type === 'CallExpression') return definitionBinding(node.parent);
  if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier')
    return node.id;
  if (node.type === 'Property') return node.key;
  return undefined;
}
function componentDefinition(node: ParentNode): Node | undefined {
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'FunctionDeclaration') return parent.id ?? undefined;
    if (parent.type === 'FunctionExpression')
      return parent.id ?? definitionBinding(parent.parent);
    if (parent.type === 'ArrowFunctionExpression')
      return definitionBinding(parent.parent);
    parent = parent.parent;
  }
  return undefined;
}

function reportDefinition(
  node: ParentNode,
  context: Context,
  definitions: Set<Node>
) {
  const definition = componentDefinition(node);
  if (
    definition &&
    named(tagOrIdentifier(definition)) &&
    !definitions.has(definition)
  ) {
    context.report({ node: definition, messageId: 'named' });
    definitions.add(definition);
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    docs: {
      description:
        'Reject decorative eyebrow, overline, and kicker text in rendered UI.',
    },
    messages: {
      named:
        'Do not render decorative eyebrow, overline, or kicker text. Use the heading itself and put useful metadata below it.',
      preceding:
        'Remove the small standalone label above this heading. Put useful metadata after the heading.',
    },
  },
  create(context) {
    const reported = new Set<Node>();
    const definitions = new Set<Node>();
    const inspect = (node: ParentNode) => {
      reportDefinition(node, context, definitions);
      const parent = node.parent;
      if (
        node.type === 'JSXExpressionContainer' &&
        parent?.type === 'JSXElement' &&
        !reported.has(parent) &&
        renderedReferences(node.expression, context).some(named)
      ) {
        context.report({ node, messageId: 'named' });
        reported.add(parent);
        return;
      }
      if (node.type === 'JSXElement' && explicitName(node, context)) {
        context.report({ node, messageId: 'named' });
        reported.add(node);
        return;
      }
      if (labelBeforeHeading(node, context)) {
        context.report({ node, messageId: 'preceding' });
        reported.add(node);
      }
    };
    return {
      JSXElement: inspect,
      JSXFragment: inspect,
      JSXText: inspect,
      JSXExpressionContainer: inspect,
    };
  },
};
export default rule;
