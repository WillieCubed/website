import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { DOMAIN } from './config.mts';
import { save } from './journal.mts';
import { request } from './pds.mts';
import { command } from './process.mts';
import { PDS_COMMAND } from './shared.mts';
import type { Journal, StorageFile, StorageHelper } from './types.mts';

interface ContainerMount {
  Type: string;
  Destination: string;
  Source?: string;
  Name?: string;
  RW: boolean;
}

interface ContainerInspection {
  Config: {
    Labels: Record<string, string>;
    Image: string;
    Env: string[];
    Cmd: unknown;
    Entrypoint: unknown;
  };
  State: { Running: boolean };
  HostConfig: {
    PortBindings: Record<string, { HostIp: string; HostPort: string }[]>;
    Memory: number;
    MemorySwap: number;
    NanoCpus: number;
    NetworkMode: string;
    ReadonlyRootfs: boolean;
  };
  Mounts: ContainerMount[];
}

export function inspectedContainer(name: string): ContainerInspection | null {
  const result = spawnSync('docker', ['inspect', name], { encoding: 'utf8' });
  if (result.status !== 0) {
    assert(/no such object/i.test(result.stderr));
    return null;
  }
  return JSON.parse(result.stdout)[0];
}
export function pdsEnvironment(journal: Journal): Record<string, string> {
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
export function assertPdsContainer(
  journal: Journal,
  container: ContainerInspection | null,
  volume: boolean
): asserts container is ContainerInspection {
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
  assertPdsMount(journal, container, volume);
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
function assertPdsMount(
  journal: Journal,
  container: ContainerInspection,
  volume: boolean
): void {
  const mounts = container.Mounts.filter(
    (entry) => entry.Destination === '/pds'
  );
  assert(mounts.length === 1);
  assert(
    volume
      ? mounts[0].Type === 'volume' &&
          mounts[0].Name === journal.storage?.volume
      : mounts[0].Type === 'bind' && mounts[0].Source === journal.data
  );
}
export function assertStorageHelper(
  journal: Journal,
  container: ContainerInspection | null,
  helper: StorageHelper
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
      (mount) =>
        mount.Type === 'volume' &&
        mount.Name === journal.storage!.volume &&
        mount.Destination === '/pds' &&
        mount.RW
    )
  );
  if (helper.source)
    assert(
      container.Mounts.some(
        (mount) =>
          mount.Type === 'bind' &&
          mount.Source === helper.source &&
          mount.Destination === '/source' &&
          !mount.RW
      )
    );
}
export function ownedVolume(journal: Journal) {
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
export function assertVolumeAttachments(journal: Journal) {
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
export async function volumeCommand(
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
export async function sourceManifest(data: string) {
  const files: StorageFile[] = [];
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
export async function recordManifest(journal: Journal) {
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
export function copyAndVerifyScript(journal: Journal) {
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
