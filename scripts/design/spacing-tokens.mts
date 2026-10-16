import postcss from 'postcss';

import {
  type SpacingFinding,
  isSpacingProperty,
  offGridLengths,
} from './spacing-values.mts';

export interface StyleSource {
  file: string;
  source: string;
}

function references(value: string): string[] {
  return [...value.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]);
}

/** Follow aliases across stylesheets so a neutral token name cannot hide spacing. */
export function inspectSpacingTokens(sources: StyleSource[]) {
  const definitions: SpacingFinding[] = [];
  const used = new Set<string>();
  const spacingReferences: { file: string; name: string }[] = [];
  for (const { file, source } of sources) {
    postcss.parse(source, { from: file }).walkDecls((declaration) => {
      const names = references(declaration.value);
      if (isSpacingProperty(declaration.prop))
        names.forEach((name) => used.add(name));
      names
        .filter((name) => name.startsWith('--spacing-'))
        .forEach((name) => spacingReferences.push({ file, name }));
      if (!declaration.prop.startsWith('--')) return;
      definitions.push({
        file,
        line: declaration.source?.start?.line ?? 1,
        selector:
          declaration.parent?.type === 'rule'
            ? declaration.parent.selector.replace(/\s+/g, ' ')
            : 'tokens',
        property: declaration.prop,
        value: declaration.value,
      });
    });
  }
  let previousSize = -1;
  while (used.size !== previousSize) {
    previousSize = used.size;
    definitions
      .filter((entry) => used.has(entry.property))
      .forEach((entry) =>
        references(entry.value).forEach((name) => used.add(name))
      );
  }
  const defined = new Set(definitions.map((entry) => entry.property));
  return {
    hidden: definitions.filter(
      (entry) =>
        used.has(entry.property) &&
        !isSpacingProperty(entry.property) &&
        offGridLengths(entry.value).length > 0
    ),
    missing: spacingReferences.filter((entry) => !defined.has(entry.name)),
  };
}
