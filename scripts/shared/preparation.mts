import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface Preparation {
  root: string;
  name: string;
  inputs: string[];
  outputs: string[];
  exclude?: string[];
  configuration?: unknown;
  generate: () => Promise<void>;
}

async function fingerprint(
  root: string,
  paths: string[],
  exclude: string[] = []
) {
  const hash = createHash('sha256');
  let missing = false;
  async function visit(path: string) {
    if (exclude.includes(path)) return;
    const absolute = join(root, path);
    let info;
    try {
      info = await stat(absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      missing = true;
      hash.update(`missing:${path}\0`);
      return;
    }
    hash.update(`${path}\0`);
    if (info.isDirectory()) {
      const children = (await readdir(absolute)).sort();
      if (children.length === 0) missing = true;
      for (const child of children) await visit(join(path, child));
    } else {
      hash.update(await readFile(absolute));
    }
    hash.update('\0');
  }
  for (const path of [...paths].sort()) await visit(path);
  return { hash: hash.digest('hex'), missing };
}

/** Reuse only complete artifacts whose input and output bytes still match. */
export async function prepareArtifact({
  root,
  name,
  inputs,
  outputs,
  exclude,
  configuration,
  generate,
}: Preparation) {
  const cacheDirectory = join(root, '.cache/preparation');
  const cachePath = join(cacheDirectory, `${name}.json`);
  const source = await fingerprint(root, inputs, exclude);
  const input = createHash('sha256')
    .update(JSON.stringify([process.version, configuration, source.hash]))
    .digest('hex');
  const output = await fingerprint(root, outputs);
  let previous;
  try {
    previous = JSON.parse(await readFile(cachePath, 'utf8'));
  } catch (error) {
    if (
      !(error instanceof SyntaxError) &&
      (error as NodeJS.ErrnoException).code !== 'ENOENT'
    )
      throw error;
  }
  if (
    !output.missing &&
    previous?.input === input &&
    previous?.output === output.hash
  ) {
    console.log(`Reusing ${name}.`);
    return;
  }
  await generate();
  const generated = await fingerprint(root, outputs);
  if (generated.missing) throw new Error(`${name} left a missing output.`);
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cachePath, JSON.stringify({ input, output: generated.hash }));
}
