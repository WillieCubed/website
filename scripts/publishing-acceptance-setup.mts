import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { provisionAcceptanceIdentities } from './atproto-acceptance-identities.mts';

async function main() {
  const { values } = parseArgs({
    options: { env: { type: 'string' }, journal: { type: 'string' } },
  });
  for (const [command, args] of [
    ['vercel', ['whoami']],
    ['gh', ['auth', 'status']],
  ] as const) {
    const result = spawnSync(command, [...args], { encoding: 'utf8' });
    if (result.status !== 0)
      throw new Error('Existing CLI authentication is unavailable.');
  }
  const identities = await provisionAcceptanceIdentities({
    envPath: values.env,
    journalPath: values.journal,
  });
  console.log(
    'Step 6: Continue the acceptance runner with the two owned provider identities.'
  );
  console.log(
    `The publisher is ${identities.publisher.handle}. The visitor is ${identities.visitor.handle}.`
  );
  console.log(
    'The runner will exercise normal provider authorization. No user-managed test accounts or copied passwords are required.'
  );
}
await main().catch(() => {
  console.error(
    'Acceptance setup failed. The private ownership journal retains recovery state. Credential values are withheld.'
  );
  process.exitCode = 1;
});
