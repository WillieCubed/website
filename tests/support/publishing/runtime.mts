import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** All runners use the checkout, independent of their module depth or caller cwd. */
export const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
export const entrypointPath = (name: string) =>
  resolve(repositoryRoot, 'scripts', name);

export function isMain(url: string): boolean {
  return Boolean(
    process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url)
  );
}

/** Verification provenance stays bound to its run; cleanup records its own source. */
export async function bindSourceManifest(
  receipt: {
    verifierSourceFiles?: Record<string, string>;
    cleanupSourceFiles?: Record<string, string>;
  },
  entrypoint: string | readonly string[],
  phase: 'verification' | 'cleanup',
  checkout = repositoryRoot
): Promise<void> {
  if (phase === 'verification' && receipt.verifierSourceFiles) return;
  const field =
    phase === 'cleanup' ? 'cleanupSourceFiles' : 'verifierSourceFiles';
  receipt[field] = await sourceManifests(
    typeof entrypoint === 'string' ? [entrypoint] : entrypoint,
    checkout
  );
}

/** Include separately launched commands as well as each command's imported modules. */
export async function sourceManifests(
  entrypoints: readonly string[],
  checkout = repositoryRoot
): Promise<Record<string, string>> {
  const manifests = await Promise.all(
    entrypoints.map((path) => sourceManifest(path, checkout))
  );
  const hashes: Record<string, string> = {};
  for (const manifest of manifests) Object.assign(hashes, manifest);
  return Object.fromEntries(
    Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b))
  );
}

/** Hash local source dependencies without importing or executing a runner. */
export async function sourceManifest(
  entrypoint: string,
  checkout = repositoryRoot
): Promise<Record<string, string>> {
  const root = await realpath(checkout);
  const entries = new Map<string, string>();
  async function visit(path: string): Promise<void> {
    const actual = await realpath(path);
    const key = relative(root, actual);
    if (key === '..' || key.startsWith('../') || isAbsolute(key))
      throw new Error('Source dependency is outside the checkout.');
    if (entries.has(key)) return;
    const bytes = await readFile(actual);
    entries.set(key, createHash('sha256').update(bytes).digest('hex'));
    if (!/\.(?:[cm]?[jt]sx?)$/.test(actual)) return;
    const tree = ts.createSourceFile(
      actual,
      bytes.toString('utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    const references: string[] = [];
    function collect(node: ts.Node): void {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        references.push(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        references.push(node.arguments[0].text);
      ts.forEachChild(node, collect);
    }
    collect(tree);
    for (const reference of references) {
      if (!reference.startsWith('.') && !reference.startsWith('@/')) continue;
      const target = reference.startsWith('@/')
        ? resolve(root, reference.slice(2))
        : resolve(dirname(actual), reference);
      let found: string | undefined;
      for (const candidate of [
        target,
        ...[
          '.ts',
          '.tsx',
          '.mts',
          '.mjs',
          '.js',
          '/index.ts',
          '/index.mts',
        ].map((suffix) => target + suffix),
      ]) {
        try {
          if ((await stat(candidate)).isFile()) {
            found = candidate;
            break;
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      if (!found)
        throw new Error(`Source dependency cannot be found: ${reference}`);
      await visit(found);
    }
  }
  await visit(entrypoint);
  return Object.fromEntries(
    [...entries].sort(([a], [b]) => a.localeCompare(b))
  );
}
