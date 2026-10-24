import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

import { BASE_URL } from './preview-visits.mts';

const READY_TIMEOUT_MS = 180_000;

export async function assertPreviewPortAvailable(baseUrl = BASE_URL) {
  const url = new URL(baseUrl);
  const probe = createServer();
  const host = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname;
  await new Promise<void>((resolve, reject) => {
    probe.once('error', () =>
      reject(new Error(`Managed preview port ${url.port} is already in use.`))
    );
    probe.listen(Number(url.port), host, () =>
      probe.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
  });
}

function rejectUnhealthyReadiness(response: Response | undefined) {
  if (response && response.status >= 400)
    throw new Error(
      `Cloudflare preview readiness route returned HTTP ${response.status}.`
    );
}

async function cancelReadinessResponse(response: Response | undefined) {
  await response?.body?.cancel();
}

export async function waitUntilReady(
  preview: ChildProcess,
  getSpawnError: () => Error | undefined,
  hasReadySignal: () => boolean = () => true
) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const failure = previewFailure(preview, getSpawnError);
    if (failure) throw failure;
    let response: Response | undefined;
    try {
      response = await fetch(BASE_URL, {
        signal: AbortSignal.timeout(2_000),
      });
    } catch (error) {
      lastError = error;
    }
    await cancelReadinessResponse(response);
    if (response?.ok && hasReadySignal()) return;
    rejectUnhealthyReadiness(response);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `Cloudflare preview did not become ready at ${BASE_URL} within ${READY_TIMEOUT_MS}ms.${lastError ? ` Last error: ${String(lastError)}` : ''}`
  );
}

function signalPreview(preview: ChildProcess, signal: NodeJS.Signals) {
  if (preview.pid === undefined) return;
  try {
    if (process.platform !== 'win32') process.kill(-preview.pid, signal);
    else preview.kill(signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

export async function stopPreview(preview: ChildProcess): Promise<void> {
  if (preview.pid === undefined) return;
  const exited = preview.exitCode !== null || preview.signalCode !== null;
  const exit = exited ? Promise.resolve() : once(preview, 'exit');
  signalPreview(preview, 'SIGTERM');
  if (!exited) {
    await Promise.race([exit, delay(5_000, undefined, { ref: false })]);
  }
  // A wrapper can exit before its signal-resistant descendants release the port.
  signalPreview(preview, 'SIGKILL');
  await delay(50);
}

function previewFailure(
  preview: ChildProcess,
  getError: () => Error | undefined
) {
  const error = getError();
  if (error) return error;
  if (preview.exitCode !== null || preview.signalCode !== null)
    return new Error(
      `Cloudflare preview exited early with status ${preview.exitCode ?? preview.signalCode}.`
    );
  return undefined;
}

export async function monitorPreview<T>(
  preview: ChildProcess,
  getError: () => Error | undefined,
  action: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const cancellation = new AbortController();
  let timer: ReturnType<typeof setInterval> | undefined;
  const failure = new Promise<never>((_, reject) => {
    timer = setInterval(() => {
      const error = previewFailure(preview, getError);
      if (error) {
        cancellation.abort(error);
        reject(error);
      }
    }, 50);
  });
  try {
    const initialError = previewFailure(preview, getError);
    if (initialError) throw initialError;
    const result = await Promise.race([action(cancellation.signal), failure]);
    const finalError = previewFailure(preview, getError);
    if (finalError) throw finalError;
    return result;
  } catch (error) {
    cancellation.abort(error);
    throw error;
  } finally {
    clearInterval(timer);
  }
}

export function previewRuntimeError(output: string): Error | undefined {
  if (
    /Address already in use|EADDRINUSE|Workers runtime failed to start/.test(
      output
    )
  )
    return new Error('Managed Cloudflare preview failed to bind or start.');
  return undefined;
}
