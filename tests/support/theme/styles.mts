import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Inspect the same ordered stylesheet after component rules are extracted. */
export async function readStylesheet(path: string): Promise<string> {
  const source = await readFile(path, 'utf8');
  const imports = [...source.matchAll(/@import ['"]([^'"]+)['"];?/g)];
  let result = source;
  for (const match of imports)
    result = result.replace(
      match[0],
      await readStylesheet(resolve(dirname(path), match[1]))
    );
  return result;
}
