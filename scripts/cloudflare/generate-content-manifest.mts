import { imageSize } from 'image-size';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import prettier from 'prettier';

import { isMain } from '../shared/command.mts';

export async function generateContentManifest() {
  const root = process.cwd();
  const files: Record<string, string> = {};
  const binaryFiles: Record<string, string> = {};
  const imageDimensions: Record<string, { width: number; height: number }> = {};
  function images(directory: string) {
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) images(path);
      else if (/\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(entry.name)) {
        try {
          const size = imageSize(readFileSync(join(root, path)));
          if (size.width !== 0 && size.height !== 0)
            imageDimensions['/' + relative('public', path)] = {
              width: size.width,
              height: size.height,
            };
        } catch {
          /* Unsupported assets use a bounded presentation slot. */
        }
      }
    }
  }
  images('public');

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
  const source = `// Generated runtime content manifest.\nexport const imageDimensions: Record<string, { width: number; height: number }> = ${JSON.stringify(imageDimensions)};\nexport const runtimeFiles: Record<string, string> = ${JSON.stringify(files)};\nexport const runtimeBinaryFiles: Record<string, string> = ${JSON.stringify(binaryFiles)};\n`;
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
