import { PasswordSession } from '@atcute/password-session';
import { spawnSync } from 'node:child_process';
import { stdin, stdout } from 'node:process';
import { setTimeout } from 'node:timers/promises';

const scope = 'williecubed-projects';
const repo = 'WillieCubed/website';
const origin = 'https://willie.page';
function run(command: string, args: string[], input?: string): string {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    input,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(`${command} failed. ${result.stderr}`);
  return result.stdout.trim();
}
async function hiddenPassword(): Promise<string> {
  if (!stdin.isTTY)
    throw new Error('Run this script in an interactive terminal.');
  stdout.write('Paste the new app password, then press Enter: ');
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
      for (const char of chunk) {
        if (char === '\u0003') {
          finish();
          reject(new Error('Setup cancelled.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          finish();
          resolve(value.trim());
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    stdin.on('data', read);
  });
}
async function fetchJSON(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok)
    throw new Error(
      `Verification failed with HTTP ${response.status} at ${url}.`
    );
  return response.json();
}

console.log('Step 1: Check the existing Vercel and GitHub CLI credentials.');
run('vercel', ['whoami']);
run('gh', ['auth', 'status']);
console.log(
  'Step 2: Create an app password named "willie.page publishing" in the signed-in Bluesky account.'
);
console.log(
  'Open https://bsky.app/settings/app-passwords, choose Add App Password, and copy its value.'
);
spawnSync('open', ['https://bsky.app/settings/app-passwords'], {
  stdio: 'ignore',
});
const password = await hiddenPassword();
console.log(
  'Step 3: Validate the app password against the publication owner’s resolved PDS.'
);
const verification = await fetch(
  origin + '/.well-known/site.standard.publication'
).then((r) => {
  if (!r.ok) throw new Error('Publication discovery is unavailable.');
  return r.text();
});
const uri = verification.trim();
const [, , did, collection, rkey] = uri.split('/');
if (
  !did?.startsWith('did:plc:') ||
  collection !== 'site.standard.publication' ||
  !rkey
)
  throw new Error('Publication discovery returned an invalid URI.');
const identity = await fetchJSON(
  `https://plc.directory/${encodeURIComponent(did)}`
);
const pds = identity.service?.find(
  (service: { type: string }) => service.type === 'AtprotoPersonalDataServer'
)?.serviceEndpoint;
if (typeof pds !== 'string' || !pds.startsWith('https://'))
  throw new Error('The identity does not name an HTTPS PDS.');
const session = await PasswordSession.login({
  service: pds,
  identifier: did,
  password,
});
await session.logout();
console.log(
  'Step 4: Store ATPROTO_APP_PASSWORD as a sensitive production-only Vercel variable.'
);
run(
  'vercel',
  [
    'env',
    'add',
    'ATPROTO_APP_PASSWORD',
    'production',
    '--project',
    'website',
    '--scope',
    scope,
    '--sensitive',
    '--force',
    '--yes',
  ],
  password + '\n'
);
if (process.argv.includes('--credential-only')) {
  console.log(
    'Credential setup is complete. The implementing agent can now deploy and verify publishing.'
  );
} else {
  console.log(
    'Step 5: Rebuild the current production deployment with the new credential.'
  );
  run('vercel', [
    'redeploy',
    origin,
    '--target',
    'production',
    '--scope',
    scope,
    '--non-interactive',
  ]);
  const sha = run('gh', [
    'api',
    `repos/${repo}/branches/main`,
    '--jq',
    '.commit.sha',
  ]);
  for (let attempt = 0; attempt < 60; attempt++) {
    const revision = await fetchJSON(origin + '/api/indieweb/revision');
    if (revision.sha === sha) break;
    if (attempt === 59)
      throw new Error('Production did not serve the current main revision.');
    await setTimeout(10000);
  }
  console.log(
    'Step 6: Run the production notification workflow and require publication sync success.'
  );
  const since = new Date().toISOString();
  run('gh', [
    'workflow',
    'run',
    'indieweb-publish.yml',
    '--repo',
    repo,
    '--ref',
    'main',
  ]);
  let runId: number | undefined;
  for (let attempt = 0; attempt < 30 && !runId; attempt++) {
    const runs = JSON.parse(
      run('gh', [
        'run',
        'list',
        '--repo',
        repo,
        '--workflow',
        'indieweb-publish.yml',
        '--event',
        'workflow_dispatch',
        '--json',
        'databaseId,createdAt,headSha',
      ])
    );
    runId = runs.find(
      (item: { createdAt: string; headSha: string }) =>
        item.createdAt >= since.slice(0, 19) + 'Z' && item.headSha === sha
    )?.databaseId;
    if (!runId) await setTimeout(2000);
  }
  if (!runId) throw new Error('GitHub did not return the dispatched workflow.');
  const watched = spawnSync(
    'gh',
    ['run', 'watch', String(runId), '--repo', repo, '--exit-status'],
    { stdio: 'inherit' }
  );
  if (watched.status !== 0) throw new Error('Production publishing failed.');
  console.log(
    'Step 7: Verify the publication record and public OAuth discovery endpoints.'
  );
  const url = new URL('/xrpc/com.atproto.repo.getRecord', pds);
  url.search = new URLSearchParams({ repo: did, collection, rkey }).toString();
  const record = await fetchJSON(url.href);
  if (record.uri !== uri || record.value.url.replace(/\/$/, '') !== origin)
    throw new Error('The publication record does not match site verification.');
  const metadata = await fetchJSON(origin + '/oauth-client-metadata.json');
  const jwks = await fetchJSON(origin + '/.well-known/atproto-jwks.json');
  if (
    metadata.client_id !== origin + '/oauth-client-metadata.json' ||
    metadata.scope !== 'atproto include:site.standard.authSocial' ||
    !jwks.keys?.length ||
    jwks.keys.some((key: { d?: string }) => key.d)
  )
    throw new Error('OAuth discovery is invalid.');
  console.log(
    `Publishing is verified at ${uri}. OAuth discovery is public. Existing drafts remain drafts.`
  );
}
