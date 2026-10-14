import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..'
);
export function isMain(url: string): boolean {
  return Boolean(
    process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url)
  );
}
