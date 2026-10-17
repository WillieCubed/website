import postcss, { type Declaration } from 'postcss';

import type { SpacingFinding } from './spacing-values.mts';

/** Pixel values of the type-size and corner-radius tokens, by token name. */
export interface TokenScale {
  fontSize: Map<number, string[]>;
  radius: Map<number, string>;
}

const single = /^(-?(?:\d*\.)?\d+)(px|rem)$/;

function pixels(value: string): number | undefined {
  const match = single.exec(value.trim());
  if (!match) return;
  return Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
}

/** Read the scales from the site theme and the framework's radius theme. */
export function tokenScale(sources: string[]): TokenScale {
  const fontSize = new Map<number, string[]>();
  const radius = new Map<number, string>();
  for (const source of sources)
    postcss.parse(source).walkDecls((declaration) => {
      const size = pixels(declaration.value);
      if (size === undefined) return;
      if (/^--text-[a-z]+-[a-z]+$/.test(declaration.prop))
        fontSize.set(size, [...(fontSize.get(size) ?? []), declaration.prop]);
      else if (/^--radius-[a-z0-9]+$/.test(declaration.prop))
        radius.set(size, declaration.prop);
    });
  return { fontSize, radius };
}

function weight(declaration: Declaration): number {
  let value = '';
  declaration.parent?.each((node) => {
    if (node.type === 'decl' && node.prop === 'font-weight') value = node.value;
  });
  if (value === 'bold') return 700;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 400;
}

/**
 * A size shared by several text roles goes to the role whose weight the rule
 * uses: labels are the boldest, titles medium, and body text regular.
 */
function textToken(candidates: string[], ruleWeight: number): string {
  const role =
    ruleWeight >= 600 ? 'label' : ruleWeight >= 500 ? 'title' : 'body';
  return (
    candidates.find((name) => name.startsWith(`--text-${role}-`)) ??
    candidates.find((name) => name.startsWith('--text-body-')) ??
    candidates[0]
  );
}

/** The token a raw declaration should name instead, when one has its exact value. */
export function equivalentToken(
  declaration: Declaration,
  scale: TokenScale
): string | undefined {
  const size = pixels(declaration.value);
  if (size === undefined) return;
  if (declaration.prop === 'font-size') {
    const candidates = scale.fontSize.get(size);
    return candidates && textToken(candidates, weight(declaration));
  }
  if (declaration.prop === 'border-radius') return scale.radius.get(size);
}

/** Raw type sizes and corner radii that a design token already expresses. */
export function scanTokenEquivalents(
  file: string,
  source: string,
  scale: TokenScale
): SpacingFinding[] {
  const found: SpacingFinding[] = [];
  postcss.parse(source, { from: file }).walkDecls((declaration) => {
    const token = equivalentToken(declaration, scale);
    if (!token) return;
    found.push({
      file,
      line: declaration.source?.start?.line ?? 1,
      selector:
        declaration.parent?.type === 'rule'
          ? declaration.parent.selector.replace(/\s+/g, ' ')
          : 'tokens',
      property: declaration.prop,
      value: `${declaration.value} (use var(${token}))`,
    });
  });
  return found;
}
