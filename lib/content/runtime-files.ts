import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  existsSync as nodeExistsSync,
  readFileSync as nodeReadFileSync,
  readdirSync as nodeReaddirSync,
} from 'node:fs';
import { relative } from 'node:path';

import {
  runtimeBinaryFiles,
  runtimeDirectories,
  runtimeFiles,
} from './generated-content';

function inWorker(): boolean {
  try {
    return Boolean(getCloudflareContext().env);
  } catch {
    return false;
  }
}

function key(path: string): string | null {
  const normalized = path.replaceAll('\\', '/');
  if (normalized === 'content' || normalized === 'public') return normalized;
  if (/^(content|public|brand\/fonts)\//.test(normalized)) return normalized;
  for (const prefix of ['/content/', '/public/', '/brand/fonts/']) {
    const index = normalized.indexOf(prefix);
    if (index >= 0) return normalized.slice(index + 1);
  }
  if (normalized.endsWith('/content')) return 'content';
  return null;
}

export function existsSync(path: string): boolean {
  if (!inWorker()) return nodeExistsSync(path);
  const name = key(path);
  return (
    name !== null &&
    (Object.hasOwn(runtimeFiles, name) ||
      Object.hasOwn(runtimeDirectories, name))
  );
}

export function readFileSync(path: string): Buffer;
export function readFileSync(path: string, encoding: 'utf8' | 'utf-8'): string;
export function readFileSync(
  path: string,
  encoding?: 'utf8' | 'utf-8'
): Buffer | string {
  if (!inWorker())
    return nodeReadFileSync(path, encoding as BufferEncoding | undefined);
  const name = key(path);
  const value = name === null ? undefined : runtimeFiles[name];
  if (value === undefined)
    throw new Error(
      `Runtime content file missing: ${relative(process.cwd(), path)}`
    );
  return encoding ? value : Buffer.from(value);
}

export async function readBinaryFile(path: string): Promise<Buffer> {
  if (!inWorker()) {
    const { readFile } = await import('node:fs/promises');
    return readFile(path);
  }
  const name = key(path);
  const value = name === null ? undefined : runtimeBinaryFiles[name];
  if (value === undefined)
    throw new Error(`Runtime binary file missing: ${path}`);
  return Buffer.from(value, 'base64');
}

export function readdirSync(path: string): string[];
export function readdirSync(
  path: string,
  options: { withFileTypes: true }
): Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
export function readdirSync(path: string, options?: { withFileTypes: true }) {
  if (!inWorker())
    return nodeReaddirSync(path, options as { withFileTypes: true });
  const name = key(path);
  if (name === null)
    throw new Error(`Unknown runtime content directory: ${path}`);
  if (!Object.hasOwn(runtimeDirectories, name))
    throw new Error(`Runtime content directory missing: ${name}`);
  const children = runtimeDirectories[name];
  if (!options?.withFileTypes) return children.map(([child]) => child);
  return children.map(([child, directory]) => ({
    name: child,
    isDirectory: () => directory,
    isFile: () => !directory,
  }));
}
