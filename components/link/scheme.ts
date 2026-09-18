'use client';

import {
  Hct,
  SchemeFidelity,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';
import type { CSSProperties } from 'react';

const cache = new Map<string, CSSProperties>();

/**
 * The few Material roles a hover card uses, computed on the client from
 * the entity's brand seed. Small on purpose: the card is not a page.
 */
export function schemeVars(hex: string): CSSProperties {
  const cached = cache.get(hex);
  if (cached) return cached;
  const scheme = new SchemeFidelity(Hct.fromInt(argbFromHex(hex)), false, 0);
  const vars = {
    '--b-primary': hexFromArgb(scheme.primary),
    '--b-primary-container': hexFromArgb(scheme.primaryContainer),
    '--b-surface-container-low': hexFromArgb(scheme.surfaceContainerLow),
    '--b-outline-variant': hexFromArgb(scheme.outlineVariant),
  } as CSSProperties;
  cache.set(hex, vars);
  return vars;
}
