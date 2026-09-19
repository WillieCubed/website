'use client';

import type { CSSProperties } from 'react';

import { materialSchemeVars } from '@/lib/brand/material-scheme';

const cache = new Map<string, CSSProperties>();

/**
 * Adaptive Material roles for a hover card, computed on the client from the
 * entity's brand seed through the same resolver as ventures and initiatives.
 */
export function schemeVars(hex: string): CSSProperties {
  const cached = cache.get(hex);
  if (cached) return cached;
  const vars = materialSchemeVars(hex) as CSSProperties;
  cache.set(hex, vars);
  return vars;
}
