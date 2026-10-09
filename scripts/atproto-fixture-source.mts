import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface SourceJournal {
  version: 1;
  workspace: string;
  slug: string;
  original: string;
  sha256: string;
  removed: boolean;
  cleanup: 'pending' | 'passed';
}
export async function fixtureSource(
  output: string,
  workspace: string,
  slug: string,
  recovery = false
) {
  assert(/^[a-z0-9-]+-acceptance-[a-z0-9-]+$/.test(slug));
  const path = resolve(workspace, 'content/writings', `${slug}.mdx`);
  const receipt = resolve(output, 'fixture-source-journal.json');
  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  let journal: SourceJournal;
  async function save() {
    await writeFile(receipt, JSON.stringify(journal, null, 2) + '\n', {
      mode: 0o600,
    });
    await chmod(receipt, 0o600);
  }
  if (recovery) {
    try {
      journal = JSON.parse(await readFile(receipt, 'utf8')) as SourceJournal;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    assert(
      journal.version === 1 &&
        journal.workspace === workspace &&
        journal.slug === slug &&
        hash(journal.original) === journal.sha256
    );
  } else {
    try {
      await readFile(path, 'utf8');
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await assert.rejects(
      readFile(receipt, 'utf8'),
      (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
    const original = `---\ntitle: 'Publishing acceptance'\ndescription: 'A temporary note for independent publishing checks.'\npublished: '${new Date().toISOString()}'\ntags: []\ndraft: false\n---\n\nThis temporary note belongs to the isolated acceptance site.\n\nFixture identifier: ${randomUUID()}.\n`;
    journal = {
      version: 1,
      workspace,
      slug,
      original,
      sha256: hash(original),
      removed: false,
      cleanup: 'pending',
    };
    await save();
    await writeFile(path, original, { flag: 'wx' });
  }
  return {
    async cleanup(deployClean: () => Promise<void>) {
      if (!journal.removed) {
        try {
          const current = await readFile(path, 'utf8');
          assert(
            hash(current) === journal.sha256 && current === journal.original,
            'The owned fixture changed. Refuse to remove another change.'
          );
          await unlink(path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        journal.removed = true;
        await save();
      } else {
        await assert.rejects(
          readFile(path, 'utf8'),
          (error: unknown) =>
            (error as NodeJS.ErrnoException).code === 'ENOENT',
          'A removed fixture was recreated. Refuse cleanup.'
        );
      }
      await deployClean();
      journal.cleanup = 'passed';
      await save();
    },
  };
}
