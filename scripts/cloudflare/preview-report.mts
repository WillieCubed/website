import { randomUUID } from 'node:crypto';
import { renameSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';

type WriteReport = (path: string, contents: string) => Promise<void>;

export async function writePreviewReport(
  path: string,
  report: unknown,
  signal?: AbortSignal,
  write: WriteReport = writeFile
) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    signal?.throwIfAborted();
    await write(temporary, `${JSON.stringify(report, null, 2)}\n`);
    signal?.throwIfAborted();
    // Cancellation cannot interleave between the guard and this atomic commit.
    renameSync(temporary, path);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
