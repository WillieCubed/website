import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { checkMediaAssets } from '../media/assets.mts';
import { isMain } from '../shared/command.mts';
import { validateMdxImageAlts, validateTsxImageAlts } from './image-alt.mts';

export async function runImageChecks() {
  function files(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    });
  }

  const issues = [
    ...files('content')
      .filter((file) => /\.mdx?$/.test(file))
      .flatMap((file) =>
        validateMdxImageAlts(file, readFileSync(file, 'utf8'))
      ),
    ...['app', 'components', 'lib']
      .flatMap(files)
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) =>
        validateTsxImageAlts(file, readFileSync(file, 'utf8'))
      ),
  ];

  if (issues.length > 0) {
    for (const { file, line, message } of issues) {
      console.error(`${relative(process.cwd(), file)}:${line}: ${message}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Image alt check passed.');
  }

  await checkMediaAssets();
  console.log('Media asset check passed.');
}

if (isMain(import.meta.url)) await runImageChecks();
