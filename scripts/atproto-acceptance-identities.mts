import { now } from '@atcute/tid';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createECDH, createHash, randomBytes } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs, parseEnv } from 'node:util';

const ACCOUNT = '18f90fa11cf0a87145be4a1517e41217';
const DOMAIN = 'willieechalmers-18f.workers.dev';
const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
const IMAGE =
  'ghcr.io/bluesky-social/pds@sha256:3a8feb3415e319dbcc13372293b7ef1fb05a318a6ff1d55968cf99ba6633c5d4';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_JOURNAL = resolve(
  ROOT,
  '.playwright-mcp/acceptance-identities/ownership.json'
);
type OwnedAccount = {
  handle: string;
  email: string;
  password: string;
  did?: string;
  appPassword?: string;
  invite?: string;
  confirmed?: boolean;
  deactivated?: boolean;
  deactivationRequested?: boolean;
  probe?: {
    rkey: string;
    value: Record<string, unknown>;
    cid?: string;
    removed?: boolean;
  };
  profile?: { value: Record<string, unknown>; cid?: string; removed?: boolean };
};
type XrpcReply = {
  did?: string;
  accessJwt: string;
  refreshJwt: string;
  code: string;
  password: string;
  cid: string;
  emailConfirmed?: boolean;
  inviteCodeRequired?: boolean;
  availableUserDomains: string[];
  handle: string;
  posts: { uri: string; cid: string; author: { did: string } }[];
  collections: string[];
  records: { uri: string; cid: string; value: Record<string, unknown> }[];
  cursor?: string;
};
type Worker = {
  name: string;
  source: string;
  versions: string[];
  removed?: boolean;
};
type Journal = {
  version: 1;
  account: string;
  domain: string;
  run: string;
  marker: string;
  origin: string;
  container: string;
  port: number;
  image: string;
  data: string;
  adminPassword: string;
  jwtSecret: string;
  rotationKey: string;
  tunnel?: { pid: number; upstream: string; command: string };
  retiredTunnels?: { pid: number; stoppedAt: string }[];
  repairedAt?: string;
  workers: Worker[];
  publisher: OwnedAccount;
  visitor: OwnedAccount;
  started: string;
  serverVersion?: string;
  advertisedVersion?: string;
  federation?: string;
  configured?: boolean;
  cleaned?: string;
  cleanupDataAuthorized?: boolean;
  containerRemoved?: boolean;
  tunnelStopped?: boolean;
  storage?: {
    volume: string;
    rollbackContainer: string;
    volumeContainer: string;
    active: boolean;
    phase:
      | 'planned'
      | 'stopped'
      | 'copied'
      | 'renamed'
      | 'verified'
      | 'rolled-back';
    manifest?: { path: string; bytes: number; sha256: string }[];
    records?: { uri: string; cid: string }[];
    sqliteChecks?: number;
    helpers: { name: string; script: string; source?: string }[];
    rollbackRequested?: boolean;
    rollbackRecordsVerified?: boolean;
    removed?: boolean;
  };
};
export type AcceptanceIdentities = {
  origin: string;
  journalPath: string;
  publisher: OwnedAccount & { did: string; appPassword: string };
  visitor: OwnedAccount & { did: string; appPassword: string };
};
const pause = (ms: number) =>
  new Promise<void>((finish) => setTimeout(finish, ms));
function command(binary: string, args: string[], input?: string) {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    input,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(`${binary} failed. Its private output is withheld.`);
  return result.stdout.trim();
}
async function privateWrite(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.new`;
  await writeFile(temporary, value, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}
async function save(path: string, journal: Journal) {
  await privateWrite(path, JSON.stringify(journal, null, 2) + '\n');
}
function validate(journal: Journal, path: string) {
  assert(
    journal.version === 1 &&
      journal.account === ACCOUNT &&
      journal.domain === DOMAIN
  );
  assert(
    /^[a-f0-9]{10}$/.test(journal.run) && /^[a-f0-9]{64}$/.test(journal.marker)
  );
  assert(journal.origin === `https://willie-pds-${journal.run}.${DOMAIN}`);
  assert(
    journal.container === `dev-williecubed-website-pds-${journal.run}` &&
      journal.image === IMAGE
  );
  assert(journal.data === resolve(dirname(path), 'pds'));
  assert(
    Number.isInteger(journal.port) &&
      journal.port > 1024 &&
      journal.port < 65536
  );
  assert(journal.publisher.handle === `pub${journal.run}.${DOMAIN}`);
  assert(journal.visitor.handle === `vis${journal.run}.${DOMAIN}`);
  assert(journal.publisher.did !== OWNER && journal.visitor.did !== OWNER);
  const names = [
    `willie-pds-${journal.run}`,
    `pub${journal.run}`,
    `vis${journal.run}`,
  ];
  assert(
    journal.workers.every(
      (worker) =>
        names.includes(worker.name) &&
        worker.source.includes(journal.marker) &&
        Array.isArray(worker.versions) &&
        worker.versions.every((source) => source.includes(journal.marker))
    )
  );
  assert(
    new Set(journal.workers.map((worker) => worker.name)).size ===
      journal.workers.length
  );
  if (journal.tunnel && journal.tunnel.upstream)
    assert(
      /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(journal.tunnel.upstream)
    );
  if (journal.storage) {
    const prefix = `dev-williecubed-website-pds-${journal.run}`;
    assert(
      journal.storage.volume === `${prefix}-data` &&
        journal.storage.rollbackContainer === `${prefix}-bind-backup` &&
        journal.storage.volumeContainer === `${prefix}-volume-backup`
    );
    assert(
      journal.storage.helpers.every(
        (helper) =>
          new RegExp(`^${prefix}-storage-[a-f0-9]{8}$`).test(helper.name) &&
          (!helper.source || helper.source === journal.data)
      )
    );
  }
}
async function cfToken() {
  const token = JSON.parse(
    command('wrangler', ['auth', 'token', '--json'])
  ) as { token?: string };
  assert(token.token, 'Cloudflare credentials are unavailable.');
  return token.token;
}
async function cloudflare(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await cfToken()}`);
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/${path}`,
    {
      ...init,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    }
  );
}
async function deployWorker(
  journal: Journal,
  journalPath: string,
  name: string,
  source: string
) {
  const previous = journal.workers.find((worker) => worker.name === name);
  const existing = await cloudflare(`workers/scripts/${name}/content/v2`);
  if (existing.ok) {
    const existingBody = await workerContent(existing);
    assert(
      previous && !previous.removed && previous.versions.includes(existingBody),
      'Refuse an unowned or changed Worker.'
    );
  } else assert(existing.status === 404, 'Cannot establish Worker ownership.');
  const worker = previous ?? { name, source, versions: [] };
  // Persist the intended resource before upload so an uncertain network outcome remains recoverable.
  if (!previous) journal.workers.push(worker);
  if (!worker.versions.includes(source)) worker.versions.push(source);
  await save(journalPath, journal);
  const form = new FormData();
  form.set(
    'metadata',
    JSON.stringify({
      main_module: 'index.mjs',
      compatibility_date: '2026-10-08',
      compatibility_flags: ['global_fetch_strictly_public'],
    })
  );
  form.set(
    'index.mjs',
    new Blob([source], { type: 'application/javascript+module' }),
    'index.mjs'
  );
  const uploaded = await cloudflare(`workers/scripts/${name}`, {
    method: 'PUT',
    body: form,
  });
  assert(uploaded.ok, `The owned Worker upload failed (${uploaded.status}).`);
  const enabled = await cloudflare(`workers/scripts/${name}/subdomain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true, previews_enabled: false }),
  });
  assert(enabled.ok, `The owned Worker hostname failed (${enabled.status}).`);
  const observed = await cloudflare(`workers/scripts/${name}/content/v2`);
  assert(
    observed.ok && (await workerContent(observed)) === source,
    'Worker upload was not observed.'
  );
  worker.source = source;
  await save(journalPath, journal);
}
async function workerContent(response: Response) {
  const form = await response.formData();
  const entries = [...form.entries()];
  assert(
    entries.length === 1 && entries[0][0] === 'index.mjs',
    'The Worker module inventory changed.'
  );
  const value = entries[0][1];
  return typeof value === 'string' ? value : value.text();
}
function proxySource(journal: Journal) {
  assert(journal.tunnel);
  return `// owned:${journal.marker}\nconst host=${JSON.stringify(new URL(journal.origin).hostname)};\nconst upstream=${JSON.stringify(journal.tunnel.upstream)};\nexport default {async fetch(request){const url=new URL(request.url);if(url.hostname!==host)return new Response('Not found',{status:404});const target=new URL(upstream);target.pathname=url.pathname;target.search=url.search;return fetch(new Request(target,request),{redirect:'manual'});}};\n`;
}
function handleSource(journal: Journal, account: OwnedAccount) {
  return `// owned:${journal.marker}\nconst host=${JSON.stringify(account.handle)};const did=${JSON.stringify(account.did ?? '')};export default {fetch(request){const url=new URL(request.url);return url.hostname===host&&url.pathname==='/.well-known/atproto-did'&&did?new Response(did,{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}}):new Response('Not found',{status:404});}};\n`;
}
async function request(
  origin: string,
  endpoint: string,
  body?: unknown,
  authorization?: string
) {
  const noInput = [
    'com.atproto.server.requestEmailConfirmation',
    'com.atproto.server.deleteSession',
  ].includes(endpoint);
  const response = await fetch(`${origin}/xrpc/${endpoint}`, {
    method: body === undefined && !noInput ? 'GET' : 'POST',
    redirect: 'error',
    headers: {
      ...(body === undefined || noInput
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: body === undefined || noInput ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      `PDS ${endpoint.split('?')[0]} failed (${response.status}, ${result.error ?? 'unavailable'}).`
    );
  }
  return (await response.json().catch(() => ({}))) as XrpcReply;
}
async function session(journal: Journal, account: OwnedAccount) {
  const result = await request(
    journal.origin,
    'com.atproto.server.createSession',
    { identifier: account.handle, password: account.password }
  );
  assert(
    result.did &&
      result.did !== OWNER &&
      (!account.did || result.did === account.did)
  );
  return result as {
    did: string;
    accessJwt: string;
    refreshJwt: string;
    emailConfirmed?: boolean;
  };
}
async function freePort() {
  const server = createServer();
  await new Promise<void>((finish, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', finish);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((finish) => server.close(() => finish()));
  return port;
}
function inspectedContainer(name: string) {
  const result = spawnSync('docker', ['inspect', name], { encoding: 'utf8' });
  if (result.status !== 0) {
    assert(/no such object/i.test(result.stderr));
    return null;
  }
  return JSON.parse(result.stdout)[0];
}
const PDS_COMMAND = [
  'sh',
  '-c',
  'node /pds/acceptance-smtp.mjs & exec node --enable-source-maps index.ts',
];
function pdsEnvironment(journal: Journal): Record<string, string> {
  return {
    PDS_HOSTNAME: new URL(journal.origin).hostname,
    PDS_JWT_SECRET: journal.jwtSecret,
    PDS_ADMIN_PASSWORD: journal.adminPassword,
    PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX: journal.rotationKey,
    PDS_DATA_DIRECTORY: '/pds',
    PDS_BLOBSTORE_DISK_LOCATION: '/pds/blocks',
    PDS_BLOB_UPLOAD_LIMIT: '4194304',
    PDS_DID_PLC_URL: 'https://plc.directory',
    PDS_BSKY_APP_VIEW_URL: 'https://api.bsky.app',
    PDS_BSKY_APP_VIEW_DID: 'did:web:api.bsky.app',
    PDS_CRAWLERS: 'https://bsky.network',
    PDS_REPORT_SERVICE_URL: 'https://mod.bsky.app',
    PDS_REPORT_SERVICE_DID: 'did:plc:ar7c4by46qjdydhdevvrndac',
    PDS_RATE_LIMITS_ENABLED: 'true',
    PDS_INVITE_REQUIRED: 'true',
    PDS_SERVICE_HANDLE_DOMAINS: `.${DOMAIN}`,
    PDS_EMAIL_SMTP_URL: 'smtp://127.0.0.1:2525',
    PDS_EMAIL_FROM_ADDRESS: 'acceptance@williecubed.dev',
    LOG_ENABLED: 'false',
  };
}
function assertPdsContainer(
  journal: Journal,
  container: ReturnType<typeof inspectedContainer>,
  volume: boolean
) {
  assert(container);
  assert(
    container.Config.Labels['dev.williecubed.website.acceptance'] ===
      journal.marker
  );
  assert(container.Config.Image === journal.image);
  const image = JSON.parse(
    command('docker', ['image', 'inspect', journal.image])
  )[0];
  const expected = new Map<string, string>(
    (image.Config.Env ?? []).map((entry: string) => {
      const i = entry.indexOf('=');
      return [entry.slice(0, i), entry.slice(i + 1)];
    })
  );
  for (const [name, value] of Object.entries(pdsEnvironment(journal)))
    expected.set(name, value);
  const actual = new Map<string, string>(
    container.Config.Env.map((entry: string) => {
      const i = entry.indexOf('=');
      return [entry.slice(0, i), entry.slice(i + 1)];
    })
  );
  assert(
    isDeepStrictEqual(actual, expected),
    'The owned PDS environment changed.'
  );
  assert(
    isDeepStrictEqual(container.Config.Cmd, PDS_COMMAND),
    'The owned PDS start command changed.'
  );
  assert(
    isDeepStrictEqual(container.Config.Entrypoint, image.Config.Entrypoint),
    'The owned PDS entrypoint changed.'
  );
  const mounts = container.Mounts.filter(
    (entry: { Destination: string }) => entry.Destination === '/pds'
  );
  assert(mounts.length === 1);
  assert(
    volume
      ? mounts[0].Type === 'volume' &&
          mounts[0].Name === journal.storage?.volume
      : mounts[0].Type === 'bind' && mounts[0].Source === journal.data
  );
  const ports = container.HostConfig.PortBindings['3000/tcp'];
  assert(
    ports.length === 1 &&
      ports[0].HostIp === '127.0.0.1' &&
      ports[0].HostPort === String(journal.port)
  );
  assert(
    container.HostConfig.Memory === 1073741824 &&
      container.HostConfig.MemorySwap === 1073741824 &&
      container.HostConfig.NanoCpus === 1000000000
  );
}
function assertStorageHelper(
  journal: Journal,
  container: ReturnType<typeof inspectedContainer>,
  helper: NonNullable<Journal['storage']>['helpers'][number]
) {
  assert(container && journal.storage);
  assert(
    container.Config.Labels['dev.williecubed.website.acceptance'] ===
      journal.marker && container.Config.Image === journal.image
  );
  assert(
    isDeepStrictEqual(container.Config.Cmd, [
      '--input-type=module',
      '-e',
      helper.script,
    ])
  );
  assert(isDeepStrictEqual(container.Config.Entrypoint, ['node']));
  assert(
    container.HostConfig.Memory === 1073741824 &&
      container.HostConfig.MemorySwap === 1073741824 &&
      container.HostConfig.NanoCpus === 1000000000
  );
  assert(
    container.HostConfig.NetworkMode === 'none' &&
      container.HostConfig.ReadonlyRootfs === true
  );
  assert(container.Mounts.length === (helper.source ? 2 : 1));
  assert(
    container.Mounts.some(
      (mount: {
        Type: string;
        Name: string;
        Destination: string;
        RW: boolean;
      }) =>
        mount.Type === 'volume' &&
        mount.Name === journal.storage!.volume &&
        mount.Destination === '/pds' &&
        mount.RW
    )
  );
  if (helper.source)
    assert(
      container.Mounts.some(
        (mount: {
          Type: string;
          Source: string;
          Destination: string;
          RW: boolean;
        }) =>
          mount.Type === 'bind' &&
          mount.Source === helper.source &&
          mount.Destination === '/source' &&
          !mount.RW
      )
    );
}
function ownedVolume(journal: Journal) {
  assert(journal.storage);
  const result = spawnSync(
    'docker',
    ['volume', 'inspect', journal.storage.volume],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    assert(/no such volume/i.test(result.stderr));
    return null;
  }
  const volume = JSON.parse(result.stdout)[0];
  assert(
    volume.Name === journal.storage.volume &&
      volume.Driver === 'local' &&
      volume.Labels['dev.williecubed.website.acceptance'] === journal.marker
  );
  return volume;
}
function assertVolumeAttachments(journal: Journal) {
  assert(journal.storage);
  const names = command('docker', [
    'ps',
    '-a',
    '--filter',
    `volume=${journal.storage.volume}`,
    '--format',
    '{{.Names}}',
  ])
    .split('\n')
    .filter(Boolean);
  const allowed = [
    journal.container,
    journal.storage.volumeContainer,
    ...journal.storage.helpers.map((entry) => entry.name),
  ];
  assert(
    names.every((name) => allowed.includes(name)),
    'Refuse a volume attached to an unowned container.'
  );
}
async function volumeCommand(
  journal: Journal,
  path: string,
  script: string,
  source?: string
) {
  assert(journal.storage && ownedVolume(journal));
  assertVolumeAttachments(journal);
  let helper = journal.storage.helpers.find(
    (entry) => entry.script === script && entry.source === source
  );
  if (!helper) {
    helper = {
      name: `${journal.container}-storage-${randomBytes(4).toString('hex')}`,
      script,
      source,
    };
    journal.storage.helpers.push(helper);
    await save(path, journal);
  }
  const existing = inspectedContainer(helper.name);
  if (existing) {
    assertStorageHelper(journal, existing, helper);
    assert(
      !existing.State.Running,
      'An owned storage operation is still running.'
    );
    command('docker', ['rm', helper.name]);
  }
  return command('docker', [
    'run',
    '--rm',
    '--name',
    helper.name,
    '--label',
    `dev.williecubed.website.acceptance=${journal.marker}`,
    '--cpus=1',
    '--memory=1g',
    '--memory-swap=1g',
    '--network=none',
    '--read-only',
    '--mount',
    `type=volume,src=${journal.storage.volume},dst=/pds`,
    ...(source
      ? ['--mount', `type=bind,src=${source},dst=/source,readonly`]
      : []),
    '--entrypoint',
    'node',
    journal.image,
    '--input-type=module',
    '-e',
    script,
  ]);
}
async function sourceManifest(data: string) {
  const files: NonNullable<NonNullable<Journal['storage']>['manifest']> = [];
  async function walk(relative: string) {
    for (const name of await readdir(resolve(data, relative))) {
      const path = relative ? `${relative}/${name}` : name;
      const info = await lstat(resolve(data, path));
      assert(
        !info.isSymbolicLink(),
        'Refuse a storage snapshot with symbolic links.'
      );
      if (info.isDirectory()) await walk(path);
      else {
        assert(info.isFile());
        const bytes = await readFile(resolve(data, path));
        files.push({
          path,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      }
    }
  }
  await walk('');
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
async function recordManifest(journal: Journal) {
  const records: { uri: string; cid: string }[] = [];
  for (const account of [journal.publisher, journal.visitor]) {
    assert(account.did);
    const repo = await request(
      journal.origin,
      `com.atproto.repo.describeRepo?repo=${account.did}`
    );
    for (const collection of repo.collections) {
      let cursor: string | undefined;
      do {
        const page = await request(
          journal.origin,
          `com.atproto.repo.listRecords?repo=${account.did}&collection=${encodeURIComponent(collection)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
        );
        records.push(...page.records.map(({ uri, cid }) => ({ uri, cid })));
        cursor = page.cursor;
      } while (cursor);
    }
  }
  return records.sort((a, b) => a.uri.localeCompare(b.uri));
}
function copyAndVerifyScript(journal: Journal) {
  assert(journal.storage?.manifest);
  return `import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash}from'node:crypto';import{createRequire}from'node:module';
const expected=${JSON.stringify(journal.storage.manifest)};const marker=${JSON.stringify(journal.marker)};
assert.equal(fs.readFileSync('/source/.acceptance-owner','utf8'),marker);
function walk(root,relative=''){return fs.readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(e=>{const p=relative?relative+'/'+e.name:e.name;assert(!e.isSymbolicLink());return e.isDirectory()?walk(root,p):[p]})}
const names=new Set(expected.map(e=>e.path));assert(walk('/pds').every(p=>names.has(p)));
for(const file of expected){const from=path.join('/source',file.path),to=path.join('/pds',file.path);const bytes=fs.readFileSync(from);assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});fs.writeFileSync(to,bytes,{mode:0o600});fs.chmodSync(to,0o600)}
assert.deepEqual(walk('/pds').sort(),[...names].sort());
for(const file of expected){const bytes=fs.readFileSync(path.join('/pds',file.path));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256)}
fs.mkdirSync('/pds/mail',{recursive:true,mode:0o700});
const require=createRequire(fs.realpathSync('/app/node_modules/@atproto/pds/package.json'));const Database=require('better-sqlite3');let sqliteChecks=0;
for(const file of expected){const target=path.join('/pds',file.path);const fd=fs.openSync(target,'r');const header=Buffer.alloc(16);fs.readSync(fd,header,0,16,0);fs.closeSync(fd);if(header.toString()!=='SQLite format 3\\0')continue;const db=new Database(target,{readonly:true,fileMustExist:true});try{assert.deepEqual(db.pragma('integrity_check'),[{integrity_check:'ok'}]);sqliteChecks++}finally{db.close()}}
assert(sqliteChecks>0);console.log(JSON.stringify({files:expected.length,bytes:expected.reduce((a,e)=>a+e.bytes,0),sqliteChecks}));`;
}
export async function migrateAcceptanceStorage(options: {
  journalPath?: string;
  verificationCleaned: boolean;
}) {
  assert(
    options.verificationCleaned,
    'Complete pending record/grant cleanup before migrating storage.'
  );
  const path = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  const journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
  validate(journal, path);
  assert(
    !journal.cleaned &&
      journal.configured &&
      journal.publisher.did &&
      journal.visitor.did
  );
  assert(
    (await readFile(resolve(journal.data, '.acceptance-owner'), 'utf8')) ===
      journal.marker
  );
  if (!journal.storage) {
    assert(
      !inspectedContainer(`${journal.container}-bind-backup`) &&
        !inspectedContainer(`${journal.container}-volume-backup`)
    );
    journal.storage = {
      volume: `${journal.container}-data`,
      rollbackContainer: `${journal.container}-bind-backup`,
      volumeContainer: `${journal.container}-volume-backup`,
      active: false,
      phase: 'planned',
      helpers: [],
      records: await recordManifest(journal),
    };
    await save(path, journal);
  }
  const storage = journal.storage;
  assert(
    storage.phase !== 'rolled-back',
    'A rolled-back migration requires review before restarting.'
  );
  if (storage.phase === 'verified')
    return {
      status: 'passed',
      volume: storage.volume,
      records: storage.records?.length,
      sqliteChecks: storage.sqliteChecks,
    };
  if (storage.phase === 'planned') {
    const current = inspectedContainer(journal.container);
    assertPdsContainer(journal, current, false);
    if (current.State.Running)
      command('docker', ['stop', '--time', '20', journal.container]);
    assert(!inspectedContainer(journal.container).State.Running);
    storage.manifest = await sourceManifest(journal.data);
    storage.phase = 'stopped';
    await save(path, journal);
  }
  if (storage.phase === 'stopped') {
    assert(
      isDeepStrictEqual(await sourceManifest(journal.data), storage.manifest),
      'The retained source backup changed.'
    );
    const current = inspectedContainer(journal.container);
    assertPdsContainer(journal, current, false);
    assert(!current.State.Running);
    if (!ownedVolume(journal))
      command('docker', [
        'volume',
        'create',
        '--label',
        `dev.williecubed.website.acceptance=${journal.marker}`,
        storage.volume,
      ]);
    assert(ownedVolume(journal));
    const proof = JSON.parse(
      await volumeCommand(
        journal,
        path,
        copyAndVerifyScript(journal),
        journal.data
      )
    );
    storage.sqliteChecks = proof.sqliteChecks;
    storage.phase = 'copied';
    await save(path, journal);
  }
  if (storage.phase === 'copied') {
    assert(
      isDeepStrictEqual(await sourceManifest(journal.data), storage.manifest),
      'The retained source backup changed.'
    );
    const original = inspectedContainer(journal.container),
      backup = inspectedContainer(storage.rollbackContainer);
    if (!backup) {
      assertPdsContainer(journal, original, false);
      assert(!original.State.Running);
      command('docker', [
        'rename',
        journal.container,
        storage.rollbackContainer,
      ]);
    } else {
      assert(!original);
      assertPdsContainer(journal, backup, false);
      assert(!backup.State.Running);
    }
    storage.active = true;
    storage.phase = 'renamed';
    await save(path, journal);
  }
  await repairAcceptanceInfrastructure({ journalPath: path });
  Object.assign(journal, JSON.parse(await readFile(path, 'utf8')));
  assert(
    isDeepStrictEqual(await recordManifest(journal), storage.records),
    'The migrated PDS changed existing record URIs/CIDs.'
  );
  assert(
    isDeepStrictEqual(await sourceManifest(journal.data), storage.manifest),
    'The retained source backup changed.'
  );
  journal.storage!.phase = 'verified';
  await save(path, journal);
  return {
    status: 'passed',
    volume: storage.volume,
    records: storage.records?.length,
    sqliteChecks: storage.sqliteChecks,
  };
}
export async function rollbackAcceptanceStorage(options: {
  journalPath?: string;
  verificationCleaned: boolean;
}) {
  assert(
    options.verificationCleaned,
    'Complete pending record/grant cleanup before rolling back storage.'
  );
  const path = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  const journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
  validate(journal, path);
  const storage = journal.storage;
  assert(storage && !journal.cleaned && storage.manifest && storage.records);
  if (storage.phase === 'rolled-back') {
    await repairAcceptanceInfrastructure({ journalPath: path });
    assert(isDeepStrictEqual(await recordManifest(journal), storage.records));
    return { status: 'passed', storage: 'bind' };
  }
  storage.rollbackRequested = true;
  await save(path, journal);
  const original = inspectedContainer(storage.rollbackContainer);
  const current = inspectedContainer(journal.container);
  if (!original) {
    assertPdsContainer(journal, current, false);
    const retained = inspectedContainer(storage.volumeContainer);
    assertPdsContainer(journal, retained, true);
    assert(!retained.State.Running);
    storage.active = false;
    await save(path, journal);
    await repairAcceptanceInfrastructure({ journalPath: path });
    Object.assign(journal, JSON.parse(await readFile(path, 'utf8')));
    assert(isDeepStrictEqual(await recordManifest(journal), storage.records));
    journal.storage!.phase = 'rolled-back';
    await save(path, journal);
    return { status: 'passed', storage: 'bind' };
  }
  assert(
    isDeepStrictEqual(await sourceManifest(journal.data), storage.manifest),
    'The retained bind backup changed.'
  );
  assertPdsContainer(journal, original, false);
  assert(!original.State.Running);
  if (current) {
    assertPdsContainer(journal, current, true);
    if (current.State.Running) {
      assert(
        isDeepStrictEqual(await recordManifest(journal), storage.records),
        'Refuse rollback after PDS records changed.'
      );
      storage.rollbackRecordsVerified = true;
      await save(path, journal);
      command('docker', ['stop', '--time', '20', journal.container]);
    } else
      assert(
        storage.phase !== 'verified' || storage.rollbackRecordsVerified,
        'Restore health and verify current records before rolling back a used volume.'
      );
    assert(!inspectedContainer(storage.volumeContainer));
    command('docker', ['rename', journal.container, storage.volumeContainer]);
  } else {
    const retained = inspectedContainer(storage.volumeContainer);
    assertPdsContainer(journal, retained, true);
    assert(!retained.State.Running);
  }
  command('docker', ['rename', storage.rollbackContainer, journal.container]);
  storage.active = false;
  await save(path, journal);
  await repairAcceptanceInfrastructure({ journalPath: path });
  Object.assign(journal, JSON.parse(await readFile(path, 'utf8')));
  assert(isDeepStrictEqual(await recordManifest(journal), storage.records));
  journal.storage!.phase = 'rolled-back';
  await save(path, journal);
  return { status: 'passed', storage: 'bind' };
}
async function ensureContainer(journal: Journal, journalPath: string) {
  assert(
    !journal.storage ||
      journal.storage.active ||
      journal.storage.phase === 'rolled-back' ||
      journal.storage.rollbackRequested,
    'Resume the journaled storage migration before restarting the bind container.'
  );
  try {
    await stat(resolve(journal.data, '.acceptance-owner'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    assert(
      !journal.workers.length &&
        !journal.tunnel &&
        !journal.publisher.did &&
        !journal.visitor.did,
      'Refuse an unmarked data directory after live resources were created.'
    );
    command('docker', ['info', '--format', '{{.ServerVersion}}']);
    const container = spawnSync('docker', ['inspect', journal.container], {
      encoding: 'utf8',
    });
    assert(
      container.status !== 0 && container.stderr.includes('No such object'),
      'Refuse an existing container without its data marker.'
    );
    let names: string[];
    try {
      names = await readdir(journal.data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await mkdir(journal.data, { mode: 0o700 });
      names = [];
    }
    assert(!names.length, 'Refuse an unmarked nonempty data directory.');
    await privateWrite(
      resolve(journal.data, '.acceptance-owner'),
      journal.marker
    );
  }
  assert(
    (await readFile(resolve(journal.data, '.acceptance-owner'), 'utf8')) ===
      journal.marker,
    'The PDS directory is not owned by this journal.'
  );
  if (journal.storage?.active) {
    assert(ownedVolume(journal));
    await volumeCommand(
      journal,
      journalPath,
      `import fs from'node:fs';import assert from'node:assert/strict';assert.equal(fs.readFileSync('/pds/.acceptance-owner','utf8'),${JSON.stringify(journal.marker)});`
    );
  } else {
    await mkdir(resolve(journal.data, 'mail'), {
      recursive: true,
      mode: 0o700,
    });
    await privateWrite(
      resolve(journal.data, 'acceptance-smtp.mjs'),
      await readFile(
        resolve(ROOT, 'scripts/atproto-acceptance-smtp.mjs'),
        'utf8'
      )
    );
  }
  const envPath = resolve(dirname(journalPath), 'pds.env');
  await privateWrite(
    envPath,
    Object.entries(pdsEnvironment(journal))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n'
  );
  command('docker', ['info', '--format', '{{.ServerVersion}}']);
  const existing = spawnSync('docker', ['inspect', journal.container], {
    encoding: 'utf8',
  });
  if (existing.status === 0) {
    const container = JSON.parse(existing.stdout)[0];
    assertPdsContainer(journal, container, Boolean(journal.storage?.active));
    if (!container.State.Running)
      command('docker', ['start', journal.container]);
  } else {
    command('docker', [
      'run',
      '-d',
      '--name',
      journal.container,
      '--cpus=1',
      '--memory=1g',
      '--memory-swap=1g',
      '--label',
      `dev.williecubed.website.acceptance=${journal.marker}`,
      '-p',
      `127.0.0.1:${journal.port}:3000`,
      '--mount',
      journal.storage?.active
        ? `type=volume,src=${journal.storage.volume},dst=/pds`
        : `type=bind,src=${journal.data},dst=/pds`,
      '--env-file',
      envPath,
      IMAGE,
      ...PDS_COMMAND,
    ]);
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const server = await request(
        `http://127.0.0.1:${journal.port}`,
        'com.atproto.server.describeServer'
      );
      assert(
        server.inviteCodeRequired === true &&
          server.availableUserDomains.includes(`.${DOMAIN}`)
      );
      journal.serverVersion = JSON.parse(
        command('docker', [
          'exec',
          journal.container,
          'node',
          '--input-type=module',
          '-e',
          "import fs from 'node:fs';console.log(JSON.stringify(JSON.parse(fs.readFileSync('node_modules/@atproto/pds/package.json','utf8')).version))",
        ])
      );
      const health = await fetch(
        `http://127.0.0.1:${journal.port}/xrpc/_health`,
        { signal: AbortSignal.timeout(10000) }
      );
      assert(health.ok);
      journal.advertisedVersion = (await health.json()).version;
      await save(journalPath, journal);
      return;
    } catch {
      await pause(1000);
    }
  }
  throw new Error('The isolated PDS did not become healthy.');
}
async function ensureTunnel(journal: Journal, journalPath: string) {
  if (journal.tunnel) {
    const result = spawnSync(
      'ps',
      ['-p', String(journal.tunnel.pid), '-o', 'command='],
      { encoding: 'utf8' }
    );
    if (result.status === 0) {
      assert(
        result.stdout.includes(journal.tunnel.command),
        'Refuse a reused tunnel PID.'
      );
      for (
        let attempt = 0;
        attempt < 45 && !journal.tunnel.upstream;
        attempt++
      ) {
        const text = await readFile(
          resolve(dirname(journalPath), 'tunnel.log'),
          'utf8'
        );
        const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) {
          journal.tunnel.upstream = match[0];
          await save(journalPath, journal);
          break;
        }
        await pause(1000);
      }
      assert(
        journal.tunnel.upstream,
        'The journaled tunnel has not announced its upstream.'
      );
      let healthy = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (await pdsHealth(journal.tunnel.upstream, journal)) {
          healthy = true;
          break;
        }
        await pause(1000);
      }
      if (healthy) return;
      const beforeSignal = spawnSync(
        'ps',
        ['-p', String(journal.tunnel.pid), '-o', 'command='],
        { encoding: 'utf8' }
      );
      let stopped = beforeSignal.status !== 0;
      if (!stopped) {
        assert(
          beforeSignal.stdout.trim() === journal.tunnel.command,
          'Refuse a reused tunnel PID before signaling.'
        );
        // A Quick Tunnel can expire while cloudflared retries its retired tunnel ID.
        process.kill(journal.tunnel.pid, 'SIGTERM');
      }
      for (let attempt = 0; attempt < 20 && !stopped; attempt++) {
        const current = spawnSync(
          'ps',
          ['-p', String(journal.tunnel.pid), '-o', 'stat=,command='],
          { encoding: 'utf8' }
        );
        if (current.status !== 0 || current.stdout.trim().startsWith('Z')) {
          stopped = true;
          break;
        }
        // A terminating process can lose its argv before the PID disappears.
        // No further signal is sent until a fresh invocation verifies ownership.
        await pause(250);
      }
      assert(stopped, 'The expired owned tunnel has not terminated.');
    }
    (journal.retiredTunnels ??= []).push({
      pid: journal.tunnel.pid,
      stoppedAt: new Date().toISOString(),
    });
    delete journal.tunnel;
    await save(journalPath, journal);
  }
  const args = [
    'tunnel',
    '--config',
    '/dev/null',
    '--url',
    `http://127.0.0.1:${journal.port}`,
    '--no-autoupdate',
  ];
  const log = resolve(dirname(journalPath), 'tunnel.log');
  const descriptor = openSync(log, 'w', 0o600);
  const child = spawn('cloudflared', args, {
    detached: true,
    stdio: ['ignore', descriptor, descriptor],
  });
  closeSync(descriptor);
  assert(child.pid);
  child.unref();
  const commandLine = `cloudflared ${args.join(' ')}`;
  journal.tunnel = { pid: child.pid, upstream: '', command: commandLine };
  await save(journalPath, journal);
  for (let attempt = 0; attempt < 45; attempt++) {
    const text = await readFile(log, 'utf8');
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      journal.tunnel.upstream = match[0];
      await save(journalPath, journal);
      for (let healthAttempt = 0; healthAttempt < 30; healthAttempt++) {
        if (await pdsHealth(journal.tunnel.upstream, journal)) return;
        await pause(1000);
      }
      throw new Error(
        'The new owned tunnel has not exposed the PDS health endpoint.'
      );
    }
    await pause(1000);
  }
  process.kill(child.pid, 'SIGTERM');
  throw new Error('The temporary tunnel did not start.');
}
async function pdsHealth(origin: string, journal: Journal) {
  try {
    const response = await fetch(`${origin}/xrpc/_health`, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return (
      typeof body.version === 'string' &&
      body.version === journal.advertisedVersion
    );
  } catch {
    return false;
  }
}
export async function repairAcceptanceInfrastructure(
  options: { journalPath?: string } = {}
) {
  const path = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  const journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
  validate(journal, path);
  assert(!journal.cleaned && journal.federation && journal.configured);
  assert(
    journal.publisher.did &&
      journal.visitor.did &&
      journal.publisher.appPassword &&
      journal.visitor.appPassword
  );
  await ensureContainer(journal, path);
  await ensureTunnel(journal, path);
  await deployWorker(
    journal,
    path,
    new URL(journal.origin).hostname.split('.')[0],
    proxySource(journal)
  );
  let healthy = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await pdsHealth(journal.origin, journal)) {
      healthy = true;
      break;
    }
    await pause(1000);
  }
  assert(healthy, 'The canonical PDS health endpoint did not recover.');
  let issuerMatches = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const metadata = await fetch(
        `${journal.origin}/.well-known/oauth-authorization-server`,
        { redirect: 'error', signal: AbortSignal.timeout(10000) }
      );
      if (metadata.ok && (await metadata.json()).issuer === journal.origin) {
        issuerMatches = true;
        break;
      }
    } catch {
      // The owned Worker update can reach separate Cloudflare edges at different times.
    }
    await pause(1000);
  }
  assert(issuerMatches, 'The recovered PDS OAuth issuer did not match.');
  for (const account of [journal.publisher, journal.visitor]) {
    await verifyIdentity(journal, account);
    const authenticated = await request(
      journal.origin,
      'com.atproto.server.createSession',
      { identifier: account.did, password: account.appPassword }
    );
    try {
      assert(authenticated.did === account.did);
      const current = await request(
        journal.origin,
        'com.atproto.server.getSession',
        undefined,
        `Bearer ${authenticated.accessJwt}`
      );
      assert(current.did === account.did && current.emailConfirmed === true);
    } finally {
      await request(
        journal.origin,
        'com.atproto.server.deleteSession',
        undefined,
        `Bearer ${authenticated.refreshJwt}`
      );
    }
  }
  journal.repairedAt = new Date().toISOString();
  await save(path, journal);
  return {
    origin: journal.origin,
    checkedAt: journal.repairedAt,
    publisher: journal.publisher.did,
    visitor: journal.visitor.did,
    status: 'passed' as const,
  };
}
async function provisionAccount(
  journal: Journal,
  journalPath: string,
  account: OwnedAccount
) {
  if (!account.did) {
    try {
      const recovered = await session(journal, account);
      account.did = recovered.did;
    } catch {
      if (!account.invite) {
        const invite = await request(
          journal.origin,
          'com.atproto.server.createInviteCode',
          { useCount: 1 },
          `Basic ${Buffer.from(`admin:${journal.adminPassword}`).toString('base64')}`
        );
        account.invite = invite.code;
        await save(journalPath, journal);
      }
      const created = await request(
        journal.origin,
        'com.atproto.server.createAccount',
        {
          email: account.email,
          handle: account.handle,
          password: account.password,
          inviteCode: account.invite,
        }
      );
      assert(created.did && created.did !== OWNER);
      account.did = created.did;
    }
    await save(journalPath, journal);
  }
  await deployWorker(
    journal,
    journalPath,
    account.handle.split('.')[0],
    handleSource(journal, account)
  );
  const auth = await session(journal, account);
  await verifyIdentity(journal, account);
  // Account creation can reach the relay before its new DID can be served by the handle Worker.
  await request(
    journal.origin,
    'com.atproto.identity.updateHandle',
    { handle: account.handle },
    `Bearer ${auth.accessJwt}`
  );
  if (!auth.emailConfirmed) {
    await request(
      journal.origin,
      'com.atproto.server.requestEmailConfirmation',
      {},
      `Bearer ${auth.accessJwt}`
    );
    let token: string | undefined;
    for (let attempt = 0; attempt < 15 && !token; attempt++) {
      for (const name of (
        await readdir(resolve(journal.data, 'mail'))
      ).reverse()) {
        const message = await readFile(
          resolve(journal.data, 'mail', name),
          'utf8'
        );
        if (!message.includes(account.email)) continue;
        const decoded = message
          .replace(/=\r\n/g, '')
          .replace(/=([A-F0-9]{2})/g, (_, hex: string) =>
            String.fromCharCode(parseInt(hex, 16))
          );
        token = decoded.match(
          /([a-z2-7]{5}-[a-z2-7]{5}) is your verification code/i
        )?.[1];
        if (token) break;
      }
      if (!token) await pause(1000);
    }
    assert(token, 'The provider confirmation email was not received.');
    await request(
      journal.origin,
      'com.atproto.server.confirmEmail',
      { email: account.email, token },
      `Bearer ${auth.accessJwt}`
    );
  }
  assert(
    (
      await request(
        journal.origin,
        'com.atproto.server.getSession',
        undefined,
        `Bearer ${auth.accessJwt}`
      )
    ).emailConfirmed === true
  );
  account.confirmed = true;
  if (!account.appPassword) {
    const result = await request(
      journal.origin,
      'com.atproto.server.createAppPassword',
      { name: 'willie.page acceptance', privileged: false },
      `Bearer ${auth.accessJwt}`
    );
    account.appPassword = result.password;
    await save(journalPath, journal);
  }
  const checked = await request(
    journal.origin,
    'com.atproto.server.createSession',
    { identifier: account.did, password: account.appPassword }
  );
  assert(checked.did === account.did);
  await request(
    journal.origin,
    'com.atproto.server.deleteSession',
    {},
    `Bearer ${checked.refreshJwt}`
  );
  await save(journalPath, journal);
  return auth;
}
async function verifyIdentity(journal: Journal, account: OwnedAccount) {
  assert(account.did?.startsWith('did:plc:') && account.did !== OWNER);
  const handle = await fetch(
    `https://${account.handle}/.well-known/atproto-did`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) }
  );
  assert(handle.ok && (await handle.text()).trim() === account.did);
  const resolved = await fetch(`https://plc.directory/${account.did}`, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  assert(resolved.ok);
  const identity = await resolved.json();
  assert(
    identity.id === account.did &&
      identity.alsoKnownAs.includes(`at://${account.handle}`)
  );
  assert(
    identity.service.some(
      (service: Record<string, unknown>) =>
        service.type === 'AtprotoPersonalDataServer' &&
        service.serviceEndpoint === journal.origin
    )
  );
}
async function readRecord(
  journal: Journal,
  account: OwnedAccount,
  collection: string,
  rkey: string
) {
  const response = await fetch(
    `${journal.origin}/xrpc/com.atproto.repo.getRecord?repo=${account.did}&collection=${collection}&rkey=${rkey}`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) }
  );
  if (response.status === 400) {
    const error = await response.json();
    assert(error.error === 'RecordNotFound');
    return undefined;
  }
  assert(response.ok, 'The PDS record read failed.');
  return response.json();
}
async function federation(journal: Journal, journalPath: string) {
  if (journal.federation) {
    for (const account of [journal.publisher, journal.visitor]) {
      await verifyIdentity(journal, account);
      const profile = await request(
        'https://public.api.bsky.app',
        `app.bsky.actor.getProfile?actor=${account.did}`
      );
      assert(profile.did === account.did && profile.handle === account.handle);
    }
    await removeProbes(journal, journalPath);
    return;
  }
  await request('https://bsky.network', 'com.atproto.sync.requestCrawl', {
    hostname: new URL(journal.origin).hostname,
  });
  // A newly discovered relay host starts at its current stream offset.
  // Subscribe before writing the records that must reach AppView.
  let relayActive = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const host = (await request(
        'https://bsky.network',
        `com.atproto.sync.getHostStatus?hostname=${new URL(journal.origin).hostname}`
      )) as unknown as { status?: string };
      if (host.status === 'active') {
        relayActive = true;
        break;
      }
    } catch {
      // The relay may not expose the newly requested host yet.
    }
    await pause(1000);
  }
  assert(relayActive, 'The relay has not subscribed to the owned PDS.');
  for (const [role, account] of [
    ['publisher', journal.publisher],
    ['visitor', journal.visitor],
  ] as const) {
    await verifyIdentity(journal, account);
    const auth = await session(journal, account);
    if (!account.profile) {
      assert(
        !(await readRecord(journal, account, 'app.bsky.actor.profile', 'self'))
      );
      account.profile = {
        value: {
          $type: 'app.bsky.actor.profile',
          displayName: `Website acceptance ${role}`,
          description: 'Temporary isolated protocol verification account.',
        },
      };
      await save(journalPath, journal);
    }
    if (!account.profile.cid) {
      const existing = await readRecord(
        journal,
        account,
        'app.bsky.actor.profile',
        'self'
      );
      if (existing)
        assert(isDeepStrictEqual(existing.value, account.profile.value));
      const record =
        existing ??
        (await request(
          journal.origin,
          'com.atproto.repo.putRecord',
          {
            repo: account.did,
            collection: 'app.bsky.actor.profile',
            rkey: 'self',
            record: account.profile.value,
            swapRecord: null,
          },
          `Bearer ${auth.accessJwt}`
        ));
      account.profile.cid = record.cid;
      await save(journalPath, journal);
    }
    if (!account.probe) {
      const rkey = now();
      assert(!(await readRecord(journal, account, 'app.bsky.feed.post', rkey)));
      account.probe = {
        rkey,
        value: {
          $type: 'app.bsky.feed.post',
          text: `Temporary website federation check ${journal.run} ${role}.`,
          createdAt: new Date().toISOString(),
        },
      };
      await save(journalPath, journal);
    }
    if (!account.probe.cid && !account.probe.removed) {
      const existing = await readRecord(
        journal,
        account,
        'app.bsky.feed.post',
        account.probe.rkey
      );
      if (existing)
        assert(isDeepStrictEqual(existing.value, account.probe.value));
      const record =
        existing ??
        (await request(
          journal.origin,
          'com.atproto.repo.putRecord',
          {
            repo: account.did,
            collection: 'app.bsky.feed.post',
            rkey: account.probe.rkey,
            record: account.probe.value,
            swapRecord: null,
          },
          `Bearer ${auth.accessJwt}`
        ));
      account.probe.cid = record.cid;
      await save(journalPath, journal);
    }
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      for (const account of [journal.publisher, journal.visitor]) {
        const profile = await request(
          'https://public.api.bsky.app',
          `app.bsky.actor.getProfile?actor=${account.did}`
        );
        assert(
          profile.did === account.did && profile.handle === account.handle
        );
        if (!account.probe!.removed) {
          const uri = `at://${account.did}/app.bsky.feed.post/${account.probe!.rkey}`;
          const posts = await request(
            'https://public.api.bsky.app',
            `app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`
          );
          assert(
            posts.posts.some(
              (post: XrpcReply['posts'][number]) =>
                post.uri === uri &&
                post.cid === account.probe!.cid &&
                post.author.did === account.did
            )
          );
        }
      }
      journal.federation = new Date().toISOString();
      await save(journalPath, journal);
      break;
    } catch {
      if (attempt === 59)
        throw new Error(
          'The public AppView has not independently observed both owned accounts and posts.'
        );
      await pause(5000);
    }
  }
  await removeProbes(journal, journalPath);
}
async function removeProbes(journal: Journal, journalPath: string) {
  for (const account of [journal.publisher, journal.visitor]) {
    if (!account.probe!.removed) {
      const current = await readRecord(
        journal,
        account,
        'app.bsky.feed.post',
        account.probe!.rkey
      );
      if (current) {
        assert(current.cid === account.probe!.cid);
        const auth = await session(journal, account);
        await request(
          journal.origin,
          'com.atproto.repo.deleteRecord',
          {
            repo: account.did,
            collection: 'app.bsky.feed.post',
            rkey: account.probe!.rkey,
            swapRecord: current.cid,
          },
          `Bearer ${auth.accessJwt}`
        );
      }
      assert(
        !(await readRecord(
          journal,
          account,
          'app.bsky.feed.post',
          account.probe!.rkey
        ))
      );
      account.probe!.removed = true;
      await save(journalPath, journal);
    }
  }
}
export async function loadOwnedAcceptanceIdentities(
  journalPath = DEFAULT_JOURNAL,
  expectedPublisherDid?: string
): Promise<AcceptanceIdentities> {
  journalPath = resolve(journalPath);
  const journal = JSON.parse(await readFile(journalPath, 'utf8')) as Journal;
  validate(journal, journalPath);
  assert(journal.federation && !journal.cleaned);
  assert(
    journal.publisher.did &&
      journal.publisher.appPassword &&
      journal.visitor.did &&
      journal.visitor.appPassword
  );
  assert(journal.publisher.did !== journal.visitor.did);
  if (expectedPublisherDid)
    assert(journal.publisher.did === expectedPublisherDid);
  await verifyIdentity(journal, journal.publisher);
  await verifyIdentity(journal, journal.visitor);
  return {
    origin: journal.origin,
    journalPath,
    publisher: journal.publisher as AcceptanceIdentities['publisher'],
    visitor: journal.visitor as AcceptanceIdentities['visitor'],
  };
}
export async function provisionAcceptanceIdentities(
  options: { envPath?: string; journalPath?: string } = {}
): Promise<AcceptanceIdentities> {
  const journalPath = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  let journal: Journal;
  try {
    journal = JSON.parse(await readFile(journalPath, 'utf8'));
    validate(journal, journalPath);
    assert(!journal.cleaned);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try {
      await stat(resolve(dirname(journalPath), 'pds'));
      throw new Error(
        'Refuse a preexisting PDS directory without an ownership journal.',
        { cause: error }
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const run = randomBytes(5).toString('hex');
    const key = createECDH('secp256k1');
    key.generateKeys();
    journal = {
      version: 1,
      account: ACCOUNT,
      domain: DOMAIN,
      run,
      marker: randomBytes(32).toString('hex'),
      origin: `https://willie-pds-${run}.${DOMAIN}`,
      container: `dev-williecubed-website-pds-${run}`,
      port: await freePort(),
      image: IMAGE,
      data: resolve(dirname(journalPath), 'pds'),
      adminPassword: randomBytes(32).toString('hex'),
      jwtSecret: randomBytes(32).toString('hex'),
      rotationKey: key.getPrivateKey('hex'),
      workers: [],
      publisher: {
        handle: `pub${run}.${DOMAIN}`,
        email: `publisher-${run}@williecubed.dev`,
        password: randomBytes(32).toString('base64url'),
      },
      visitor: {
        handle: `vis${run}.${DOMAIN}`,
        email: `visitor-${run}@williecubed.dev`,
        password: randomBytes(32).toString('base64url'),
      },
      started: new Date().toISOString(),
    };
    await save(journalPath, journal);
    await mkdir(journal.data, { mode: 0o700 });
    await privateWrite(
      resolve(journal.data, '.acceptance-owner'),
      journal.marker
    );
  }
  console.log(
    'Step 1: Start the owned official PDS with a 1 CPU and 1 GiB limit.'
  );
  await ensureContainer(journal, journalPath);
  console.log(
    'Step 2: Publish the owned PDS proxy and handle endpoints on the personal Workers account.'
  );
  await ensureTunnel(journal, journalPath);
  await deployWorker(
    journal,
    journalPath,
    new URL(journal.origin).hostname.split('.')[0],
    proxySource(journal)
  );
  for (const account of [journal.publisher, journal.visitor])
    await deployWorker(
      journal,
      journalPath,
      account.handle.split('.')[0],
      handleSource(journal, account)
    );
  console.log(
    'Step 3: Create two invited accounts and confirm their email through normal provider APIs.'
  );
  for (const account of [journal.publisher, journal.visitor])
    await provisionAccount(journal, journalPath, account);
  const metadata = await fetch(
    `${journal.origin}/.well-known/oauth-authorization-server`,
    { redirect: 'error', signal: AbortSignal.timeout(15000) }
  );
  assert(metadata.ok && (await metadata.json()).issuer === journal.origin);
  console.log(
    'Step 4: Wait for public PLC, relay ingestion, and independent Bluesky AppView reads.'
  );
  await federation(journal, journalPath);
  const envPath = resolve(
    options.envPath ?? resolve(ROOT, '.env.standard-test.local')
  );
  let text = '';
  try {
    text = await readFile(envPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const previous = parseEnv(text);
  const settings = {
    NEXT_PUBLIC_ATPROTO_DID: journal.publisher.did!,
    NEXT_PUBLIC_BLUESKY_HANDLE: journal.publisher.handle,
    ATPROTO_APP_PASSWORD: journal.publisher.appPassword!,
    ATPROTO_PUBLICATION_RKEY:
      previous.NEXT_PUBLIC_ATPROTO_DID === journal.publisher.did &&
      previous.ATPROTO_PUBLICATION_RKEY
        ? previous.ATPROTO_PUBLICATION_RKEY
        : now(),
    NEXT_PUBLIC_SITE_ORIGIN: 'https://indieweb-acceptance.vercel.app',
    ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL: journalPath,
    ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN: journal.origin,
  };
  await privateWrite(
    envPath,
    [
      ...text
        .split('\n')
        .filter(
          (line) =>
            line &&
            !Object.keys(settings).some((name) => line.startsWith(`${name}=`))
        ),
      ...Object.entries(settings).map(
        ([name, value]) => `${name}=${JSON.stringify(value)}`
      ),
    ].join('\n') + '\n'
  );
  console.log('Step 5: Configure only the isolated acceptance Vercel project.');
  for (const [name, value] of Object.entries(settings).filter(
    ([name]) => !name.startsWith('ATPROTO_ACCEPTANCE_')
  ))
    command(
      'vercel',
      [
        'env',
        'add',
        name,
        'production',
        '--project',
        'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm',
        '--scope',
        'williecubed-projects',
        '--force',
        '--yes',
        ...(name === 'ATPROTO_APP_PASSWORD' ? ['--sensitive'] : []),
      ],
      value + '\n'
    );
  journal.configured = true;
  await save(journalPath, journal);
  await privateWrite(
    resolve(dirname(journalPath), 'evidence.json'),
    JSON.stringify(
      {
        timestamp: journal.federation,
        origin: journal.origin,
        image: journal.image,
        serverVersion: journal.serverVersion,
        advertisedVersion: journal.advertisedVersion,
        accounts: [journal.publisher, journal.visitor].map((account) => ({
          handle: account.handle,
          did: account.did,
          emailConfirmed: account.confirmed,
          publicAppViewPostCid: account.probe?.cid,
          probeRemoved: account.probe?.removed,
        })),
        network: {
          plc: 'https://plc.directory',
          relay: 'https://bsky.network',
          appView: 'https://public.api.bsky.app',
        },
      },
      null,
      2
    ) + '\n'
  );
  return loadOwnedAcceptanceIdentities(journalPath);
}
export async function cleanupAcceptanceIdentities(options: {
  journalPath?: string;
  envPath?: string;
  verificationCleaned: boolean;
  acceptanceConfigurationCleared: boolean;
}) {
  assert(
    options.verificationCleaned && options.acceptanceConfigurationCleared,
    'Finish the owned record/grant checks and clear acceptance deployment credentials before identity teardown.'
  );
  const path = resolve(options.journalPath ?? DEFAULT_JOURNAL);
  const journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
  validate(journal, path);
  if (journal.cleaned) return;
  try {
    assert(
      (await readFile(resolve(journal.data, '.acceptance-owner'), 'utf8')) ===
        journal.marker
    );
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== 'ENOENT' ||
      !journal.cleanupDataAuthorized
    )
      throw error;
    try {
      await stat(journal.data);
      throw new Error(
        'Refuse an existing data directory with no ownership marker.',
        { cause: error }
      );
    } catch (dataError) {
      if ((dataError as NodeJS.ErrnoException).code !== 'ENOENT')
        throw dataError;
    }
    assert(
      (!journal.publisher.did || journal.publisher.deactivated) &&
        (!journal.visitor.did || journal.visitor.deactivated) &&
        journal.workers.every((worker) => worker.removed) &&
        journal.containerRemoved &&
        journal.tunnelStopped
    );
  }
  for (const account of [journal.publisher, journal.visitor]) {
    if (!account.did || account.deactivated) continue;
    if (account.deactivationRequested) {
      const status = await request(
        journal.origin,
        `com.atproto.sync.getRepoStatus?did=${account.did}`
      );
      if ((status as unknown as { active: boolean }).active === false) {
        account.deactivated = true;
        await save(path, journal);
        continue;
      }
    }
    await verifyIdentity(journal, account);
    const auth = await session(journal, account);
    const repo = await request(
      journal.origin,
      `com.atproto.repo.describeRepo?repo=${account.did}`
    );
    for (const collection of repo.collections) {
      let cursor: string | undefined;
      do {
        const records = await request(
          journal.origin,
          `com.atproto.repo.listRecords?repo=${account.did}&collection=${encodeURIComponent(collection)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
        );
        for (const record of records.records) {
          const key = record.uri.split('/').at(-1)!;
          const owned =
            collection === 'app.bsky.actor.profile' && key === 'self'
              ? account.profile
              : collection === 'app.bsky.feed.post' &&
                  key === account.probe?.rkey
                ? account.probe
                : undefined;
          assert(
            owned &&
              !owned.removed &&
              isDeepStrictEqual(owned.value, record.value) &&
              (!owned.cid || owned.cid === record.cid),
            'Refuse identity teardown while an unowned or remaining verification record exists.'
          );
          await request(
            journal.origin,
            'com.atproto.repo.deleteRecord',
            {
              repo: account.did,
              collection,
              rkey: key,
              swapRecord: record.cid,
            },
            `Bearer ${auth.accessJwt}`
          );
          assert(!(await readRecord(journal, account, collection, key)));
          owned.removed = true;
          await save(path, journal);
        }
        cursor = records.cursor;
      } while (cursor);
    }
    account.deactivationRequested = true;
    await save(path, journal);
    await request(
      journal.origin,
      'com.atproto.server.deactivateAccount',
      {},
      `Bearer ${auth.accessJwt}`
    );
    const status = await request(
      journal.origin,
      `com.atproto.sync.getRepoStatus?did=${account.did}`
    );
    assert((status as unknown as { active: boolean }).active === false);
    account.deactivated = true;
    await save(path, journal);
  }
  for (const worker of journal.workers) {
    if (worker.removed) continue;
    const existing = await cloudflare(
      `workers/scripts/${worker.name}/content/v2`
    );
    if (existing.ok) {
      const source = await workerContent(existing);
      assert(
        worker.versions.includes(source),
        'Refuse to remove a changed Worker.'
      );
      const removed = await cloudflare(`workers/scripts/${worker.name}`, {
        method: 'DELETE',
      });
      assert(removed.ok, 'The owned Worker removal failed.');
    } else assert(existing.status === 404);
    assert(
      (await cloudflare(`workers/scripts/${worker.name}/content/v2`)).status ===
        404
    );
    worker.removed = true;
    await save(path, journal);
  }
  if (journal.tunnel && !journal.tunnelStopped) {
    const child = spawnSync(
      'ps',
      ['-p', String(journal.tunnel.pid), '-o', 'command='],
      { encoding: 'utf8' }
    );
    if (child.status === 0) {
      assert(
        child.stdout.includes(journal.tunnel.command),
        'Refuse a reused tunnel PID.'
      );
      process.kill(journal.tunnel.pid, 'SIGTERM');
      let stopped = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const current = spawnSync(
          'ps',
          ['-p', String(journal.tunnel.pid), '-o', 'stat=,command='],
          { encoding: 'utf8' }
        );
        if (current.status !== 0 || current.stdout.trim().startsWith('Z')) {
          stopped = true;
          break;
        }
        assert(
          current.stdout.includes(journal.tunnel.command),
          'Refuse a reused tunnel PID.'
        );
        await pause(250);
      }
      assert(stopped, 'The owned tunnel has not terminated.');
    }
    journal.tunnelStopped = true;
    await save(path, journal);
  } else if (!journal.tunnel) {
    journal.tunnelStopped = true;
    await save(path, journal);
  }
  command('docker', ['info', '--format', '{{.ServerVersion}}']);
  const existing = spawnSync('docker', ['inspect', journal.container], {
    encoding: 'utf8',
  });
  if (existing.status === 0) {
    const container = JSON.parse(existing.stdout)[0];
    assertPdsContainer(journal, container, Boolean(journal.storage?.active));
    command('docker', ['rm', '-f', journal.container]);
  }
  if (journal.storage && !journal.storage.removed) {
    const storage = journal.storage;
    for (const [name, volume] of [
      [storage.rollbackContainer, false],
      [storage.volumeContainer, true],
    ] as const) {
      const retained = inspectedContainer(name);
      if (retained) {
        assertPdsContainer(journal, retained, volume);
        assert(!retained.State.Running);
        command('docker', ['rm', name]);
      }
    }
    for (const helper of storage.helpers) {
      const retained = inspectedContainer(helper.name);
      if (retained) {
        assertStorageHelper(journal, retained, helper);
        command('docker', ['rm', '-f', helper.name]);
      }
    }
    if (ownedVolume(journal)) {
      assertVolumeAttachments(journal);
      assert(
        !command('docker', [
          'ps',
          '-a',
          '--filter',
          `volume=${storage.volume}`,
          '--format',
          '{{.Names}}',
        ])
      );
      command('docker', ['volume', 'rm', storage.volume]);
    }
    storage.removed = true;
    await save(path, journal);
  }
  journal.containerRemoved = true;
  await save(path, journal);
  const envPath = resolve(
    options.envPath ?? resolve(ROOT, '.env.standard-test.local')
  );
  const text = await readFile(envPath, 'utf8');
  const env = parseEnv(text);
  const keys = [
    'NEXT_PUBLIC_ATPROTO_DID',
    'NEXT_PUBLIC_BLUESKY_HANDLE',
    'ATPROTO_APP_PASSWORD',
    'ATPROTO_PUBLICATION_RKEY',
    'ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL',
    'ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN',
  ];
  if (env.NEXT_PUBLIC_ATPROTO_DID === journal.publisher.did)
    await privateWrite(
      envPath,
      text
        .split('\n')
        .filter((line) => !keys.some((key) => line.startsWith(`${key}=`)))
        .join('\n')
    );
  journal.cleanupDataAuthorized = true;
  await save(path, journal);
  await rm(journal.data, { recursive: true, force: true });
  for (const name of ['pds.env', 'tunnel.log'])
    await rm(resolve(dirname(path), name), { force: true });
  journal.adminPassword = '';
  journal.jwtSecret = '';
  journal.rotationKey = '';
  for (const account of [journal.publisher, journal.visitor]) {
    account.password = '';
    delete account.appPassword;
    delete account.invite;
  }
  journal.cleaned = new Date().toISOString();
  await save(path, journal);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({
    options: {
      env: { type: 'string' },
      journal: { type: 'string' },
      cleanup: { type: 'boolean', default: false },
      repair: { type: 'boolean', default: false },
      'migrate-storage': { type: 'boolean', default: false },
      'rollback-storage': { type: 'boolean', default: false },
      'verification-cleaned': { type: 'boolean', default: false },
      'configuration-cleared': { type: 'boolean', default: false },
    },
  });
  try {
    assert(
      [
        values.repair,
        values.cleanup,
        values['migrate-storage'],
        values['rollback-storage'],
      ].filter(Boolean).length <= 1,
      'Choose one infrastructure operation.'
    );
    if (values['migrate-storage'] || values['rollback-storage']) {
      const operation = values['migrate-storage']
        ? migrateAcceptanceStorage
        : rollbackAcceptanceStorage;
      console.log(
        JSON.stringify(
          await operation({
            journalPath: values.journal,
            verificationCleaned: values['verification-cleaned'],
          })
        )
      );
      process.exit(0);
    }
    if (values.repair) {
      const repaired = await repairAcceptanceInfrastructure({
        journalPath: values.journal,
      });
      console.log(JSON.stringify(repaired));
      process.exit(0);
    }
    if (values.cleanup) {
      await cleanupAcceptanceIdentities({
        journalPath: values.journal,
        envPath: values.env,
        verificationCleaned: values['verification-cleaned'],
        acceptanceConfigurationCleared: values['configuration-cleared'],
      });
      console.log(
        'Owned acceptance identities and infrastructure are removed. Public PLC history remains.'
      );
      process.exit(0);
    }
    const identities = await provisionAcceptanceIdentities({
      envPath: values.env,
      journalPath: values.journal,
    });
    console.log(
      `Owned accounts are ready: ${identities.publisher.handle} (${identities.publisher.did}) and ${identities.visitor.handle} (${identities.visitor.did}).`
    );
    console.log(`Private recovery journal: ${identities.journalPath}`);
  } catch (error) {
    await privateWrite(
      resolve(
        dirname(resolve(values.journal ?? DEFAULT_JOURNAL)),
        'failure.json'
      ),
      JSON.stringify(
        { timestamp: new Date().toISOString(), error: String(error) },
        null,
        2
      ) + '\n'
    );
    console.error(
      `Identity bootstrap failed. Preserve the private recovery journal at ${resolve(values.journal ?? DEFAULT_JOURNAL)}. Credentials and provider URLs are withheld.`
    );
    process.exitCode = 1;
  }
}
