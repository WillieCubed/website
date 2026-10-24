import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import prettier from 'prettier';

import { generatePublicImages } from '../content/public-images.mts';
import { isMain } from '../shared/command.mts';

/** Each bundled directory records its immediate children in filesystem order. */
export function buildDirectoryIndex(
  paths: string[]
): Record<string, Array<[string, boolean]>> {
  const directories = new Map<string, Map<string, boolean>>();
  for (const path of paths) {
    const segments = path.split('/');
    for (let index = 1; index < segments.length; index++) {
      const directory = segments.slice(0, index).join('/');
      const children = directories.get(directory) ?? new Map<string, boolean>();
      children.set(segments[index], index < segments.length - 1);
      directories.set(directory, children);
    }
  }
  return Object.fromEntries(
    [...directories].map(([directory, children]) => [directory, [...children]])
  );
}

export async function generateContentManifest() {
  const root = process.cwd();
  const files: Record<string, string> = {};
  const binaryFiles: Record<string, string> = {};
  const imageDimensions = generatePublicImages(root);

  function visit(directory: string) {
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile())
        files[relative(root, join(root, path))] = readFileSync(
          join(root, path),
          'utf8'
        );
    }
  }

  visit('content');
  files['public/search-index.json'] = readFileSync(
    join(root, 'public/search-index.json'),
    'utf8'
  );
  for (const entry of readdirSync(join(root, 'brand/fonts'), {
    withFileTypes: true,
  })) {
    if (entry.isFile()) {
      const path = `brand/fonts/${entry.name}`;
      binaryFiles[path] = readFileSync(join(root, path)).toString('base64');
    }
  }
  const directories = buildDirectoryIndex(Object.keys(files));
  const source = `// Generated runtime content manifest.\nexport const imageDimensions: Record<string, { width: number; height: number; immutableSrc?: string }> = ${JSON.stringify(imageDimensions)};\nexport const runtimeFiles: Record<string, string> = ${JSON.stringify(files)};\nexport const runtimeBinaryFiles: Record<string, string> = ${JSON.stringify(binaryFiles)};\nexport const runtimeDirectories: Record<string, Array<[string, boolean]>> = ${JSON.stringify(directories)};\n`;
  const output = join(root, 'lib/content/generated-content.ts');
  writeFileSync(
    output,
    await prettier.format(source, {
      ...(await prettier.resolveConfig(output)),
      filepath: output,
    })
  );
}

if (isMain(import.meta.url)) await generateContentManifest();
