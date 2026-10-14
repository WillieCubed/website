import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await import('../tests/fixtures/atproto/smtp.mjs');
}
