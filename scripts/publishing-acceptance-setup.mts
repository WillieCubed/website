import type { Did } from '@atcute/lexicons';
import { PasswordSession } from '@atcute/password-session';
import { now } from '@atcute/tid';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

const project = 'indieweb-acceptance';
const scope = 'williecubed-projects';
function run(command: string, args: string[], input?: string): string {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}
async function hidden(): Promise<string> {
  if (!stdin.isTTY)
    throw new Error('Run this script in an interactive terminal.');
  stdout.write('Acceptance app password: ');
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {
      stdin.off('data', read);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };
    const read = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          finish();
          reject(new Error('Cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          resolve(value.trim());
          return;
        }
        if (character === '\u007f' || character === '\b')
          value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    stdin.on('data', read);
  });
}
async function json(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok)
    throw new Error(`Account discovery failed (${response.status}).`);
  return response.json();
}
console.log('Step 1: Verify the Vercel and GitHub credentials.');
run('vercel', ['whoami']);
run('gh', ['auth', 'status']);
console.log(
  'Step 2: Create a separate Bluesky account for acceptance publishing, or sign in to an existing test account.'
);
console.log(
  'Leave that account signed in. The acceptance site will request OAuth authorization later. Do not use williecubed.me.'
);
spawnSync('open', ['https://bsky.app/'], { stdio: 'ignore' });
const prompt = createInterface({ input: stdin, output: stdout });
const handle = (await prompt.question('Acceptance account handle: '))
  .replace(/^@/, '')
  .trim();
prompt.close();
const resolved = await json(
  `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
);
const did = resolved.did as Did;
if (!did || did === 'did:plc:iyn6nc3ffqm2e3555exyrgvv')
  throw new Error(
    'Acceptance requires a separate account. The production owner is forbidden.'
  );
console.log(
  'Step 3: Add an app password named "willie.page acceptance" in that test account.'
);
spawnSync('open', ['https://bsky.app/settings/app-passwords'], {
  stdio: 'ignore',
});
const password = await hidden();
const identity = await json(
  did.startsWith('did:plc:')
    ? `https://plc.directory/${encodeURIComponent(did)}`
    : `https://${did.slice(8).replace(/:/g, '/')}/.well-known/did.json`
);
const pds = identity.service?.find(
  (service: { type: string }) => service.type === 'AtprotoPersonalDataServer'
)?.serviceEndpoint;
if (typeof pds !== 'string' || !pds.startsWith('https://'))
  throw new Error('Acceptance account has no HTTPS PDS.');
console.log('Step 4: Validate the credential and reject the production owner.');
const session = await PasswordSession.login({
  service: pds,
  identifier: did,
  password,
});
if (session.did !== did) {
  await session.logout();
  throw new Error('Credential belongs to another account.');
}
await session.logout();
console.log('Step 5: Configure only the isolated acceptance project.');
const previousText = existsSync('.env.standard-test.local')
  ? readFileSync('.env.standard-test.local', 'utf8')
  : '';
const previousIdentity = previousText.match(
  /^NEXT_PUBLIC_ATPROTO_DID=(.+)$/m
)?.[1];
const previousKey = previousText.match(/^ATPROTO_PUBLICATION_RKEY=(.+)$/m)?.[1];
const settings: Record<string, string> = {
  NEXT_PUBLIC_ATPROTO_DID: did,
  NEXT_PUBLIC_BLUESKY_HANDLE: handle,
  ATPROTO_PUBLICATION_RKEY:
    previousIdentity === did && previousKey ? previousKey : now(),
  NEXT_PUBLIC_SITE_ORIGIN: 'https://indieweb-acceptance.vercel.app',
  ATPROTO_APP_PASSWORD: password,
};
for (const [name, value] of Object.entries(settings)) {
  run(
    'vercel',
    [
      'env',
      'add',
      name,
      'production',
      '--project',
      project,
      '--scope',
      scope,
      '--force',
      '--yes',
      ...(name === 'ATPROTO_APP_PASSWORD' ? ['--sensitive'] : []),
    ],
    value + '\n'
  );
}
const previous = previousText
  .split('\n')
  .filter(
    (line) =>
      line && !Object.keys(settings).some((key) => line.startsWith(key + '='))
  );
writeFileSync(
  '.env.standard-test.local',
  [
    ...previous,
    ...Object.entries(settings).map(
      ([key, value]) => `${key}=${JSON.stringify(value)}`
    ),
  ].join('\n') + '\n',
  { mode: 0o600 }
);
chmodSync('.env.standard-test.local', 0o600);
console.log(
  'Step 6: Sign in to Micropub Rocks and WebSub Rocks for independent client checks.'
);
console.log(
  'Use your existing passkey or complete the email sign-in yourself. Leave both pages open.'
);
spawnSync('open', ['https://micropub.rocks/', 'https://websub.rocks/'], {
  stdio: 'ignore',
});
const completionPrompt = createInterface({ input: stdin, output: stdout });
await completionPrompt.question(
  'Press Enter after both validator sign-ins finish: '
);
completionPrompt.close();
console.log(
  'Step 7: Keep the acceptance Bluesky account signed in for the OAuth check.'
);
console.log(
  'Acceptance setup is complete. No production project or owner PDS changed.'
);
