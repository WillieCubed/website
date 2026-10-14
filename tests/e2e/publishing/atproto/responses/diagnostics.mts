import type {} from '@atcute/atproto';
import type {} from '@atcute/bluesky';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

interface Context {
  runState: { phase: string; privateReceipt: string };
}

export async function saveFailure(dependencies: Context, error: unknown) {
  if (dependencies.runState.privateReceipt === 'the selected private receipt')
    return;
  const path = `${dependencies.runState.privateReceipt}.failure-${Date.now()}-${randomUUID()}.json`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(
    path,
    JSON.stringify(
      {
        phase: dependencies.runState.phase,
        observedAt: new Date().toISOString(),
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      null,
      2
    ) + '\n',
    { mode: 0o600 }
  );
  await chmod(path, 0o600);
  await writeFile(
    `${dependencies.runState.privateReceipt}.failure.json`,
    await readFile(path),
    {
      mode: 0o600,
      flag: 'wx',
    }
  ).catch((failure: unknown) => {
    if ((failure as NodeJS.ErrnoException).code !== 'EEXIST') throw failure;
  });
}
