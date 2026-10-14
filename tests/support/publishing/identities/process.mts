import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

export function command(binary: string, args: string[], input?: string) {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    input,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(`${binary} failed. Its private output is withheld.`);
  return result.stdout.trim();
}
export async function freePort() {
  const server = createServer();
  await new Promise<void>((finish, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', finish);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((finish) => server.close(() => finish()));
  return port;
}
