import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { generatePublicImages } from '../../../scripts/content/public-images.mts';
import { prepareArtifact } from '../../../scripts/shared/preparation.mts';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9i8AAAAASUVORK5CYII=',
  'base64'
);
const GENERATED = 'public/_content-images';

test('content preparation versions raster bytes, preserves originals, reuses outputs and repairs missing copies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'public-images-'));
  try {
    for (const path of [
      'assets/photo.png',
      'brand/photo.png',
      'api/studio/media/photo.png',
    ]) {
      await mkdir(join(root, 'public', path, '..'), { recursive: true });
      await writeFile(join(root, 'public', path), PNG);
    }
    await writeFile(
      join(root, 'public/assets/shape.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
    );
    await writeFile(
      join(root, 'public/assets/animation.gif'),
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')
    );
    let runs = 0;
    const prepare = () =>
      prepareArtifact({
        root,
        name: 'images',
        inputs: ['public'],
        outputs: ['metadata.json', GENERATED],
        exclude: [GENERATED],
        generate: async () => {
          runs++;
          await writeFile(
            join(root, 'metadata.json'),
            JSON.stringify(generatePublicImages(root))
          );
        },
      });
    await prepare();
    const first = JSON.parse(
      await readFile(join(root, 'metadata.json'), 'utf8')
    );
    const url = first['/assets/photo.png'].immutableSrc;
    assert.match(url, /^\/_content-images\/[a-f0-9]{64}\.png$/);
    assert.deepEqual(await readFile(join(root, 'public', url)), PNG);
    assert.deepEqual(
      await readFile(join(root, 'public/assets/photo.png')),
      PNG
    );
    for (const path of [
      '/brand/photo.png',
      '/api/studio/media/photo.png',
      '/assets/shape.svg',
      '/assets/animation.gif',
    ])
      assert.equal(first[path].immutableSrc, undefined);
    assert.equal(
      Object.keys(first).some((path) => path.startsWith('/_content-images/')),
      false
    );
    await prepare();
    assert.equal(
      runs,
      1,
      'generated copies must not invalidate their own input fingerprint'
    );
    await rm(join(root, 'public', url));
    await prepare();
    assert.equal(runs, 2);
    assert.deepEqual(await readFile(join(root, 'public', url)), PNG);
    const changed = Buffer.concat([PNG, Buffer.from('changed bytes')]);
    await writeFile(join(root, 'public/assets/photo.png'), changed);
    await prepare();
    const second = JSON.parse(
      await readFile(join(root, 'metadata.json'), 'utf8')
    );
    assert.notEqual(second['/assets/photo.png'].immutableSrc, url);
    assert.deepEqual(
      await readFile(join(root, 'public/assets/photo.png')),
      changed
    );
    assert.equal(
      (await readdir(join(root, GENERATED))).includes(url.split('/').at(-1)!),
      false
    );
    await prepare();
    assert.equal(runs, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
