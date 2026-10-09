import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

const IMAGE =
  'ghcr.io/bluesky-social/pds@sha256:3a8feb3415e319dbcc13372293b7ef1fb05a318a6ff1d55968cf99ba6633c5d4';
const CONTAINER = 'dev-williecubed-website-pds-3eafb75977';
const CLIENT =
  'https://indieweb-acceptance.vercel.app/oauth-client-metadata.json';
const DIDS = [
  'did:plc:l3ycfv2ycqya33wyyw6zv6j6',
  'did:plc:vvx2yc7zxnllgsk4xce5snhh',
];
const cli = promisify(execFile);
interface Mount {
  Destination: string;
  Type: string;
  Name?: string;
  Source: string;
  RW: boolean;
}
interface Container {
  Id: string;
  Image: string;
  Config: { Image: string; Labels: Record<string, string> };
  State: { Running: boolean; Paused: boolean };
  Mounts: Mount[];
}
interface Inventory {
  tokenCounts: { did: string; tokens: number }[];
  foreignTokens: { count: number; sha256: string };
}
interface Receipt extends Inventory {
  version: 1;
  status: 'passed' | 'failed';
  checkedAt: string;
  method: string;
  scope: string;
  canonicalClient: string;
  containerId: string;
  image: string;
  imageId: string;
  baselineCompared: boolean;
  foreignTokensPreserved?: boolean;
}
async function command(args: string[]) {
  try {
    return (
      await cli('docker', args, { timeout: 30000, maxBuffer: 1024 * 1024 })
    ).stdout;
  } catch {
    // Docker errors can include the executed script; never forward its output.
    throw new Error('The read-only owned-provider inventory command failed.');
  }
}
export async function verifyProviderTokenInventory(options: {
  journalPath: string;
  receiptPath: string;
  baselinePath?: string;
}): Promise<Receipt> {
  const journalPath = resolve(options.journalPath);
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  assert(
    journal.version === 1 &&
      journal.account === '18f90fa11cf0a87145be4a1517e41217' &&
      journal.domain === 'willieechalmers-18f.workers.dev' &&
      journal.run === '3eafb75977' &&
      /^[a-f0-9]{64}$/.test(journal.marker) &&
      journal.container === CONTAINER &&
      journal.image === IMAGE &&
      journal.origin ===
        'https://willie-pds-3eafb75977.willieechalmers-18f.workers.dev' &&
      journal.data === resolve(dirname(journalPath), 'pds') &&
      journal.publisher.did === DIDS[0] &&
      journal.visitor.did === DIDS[1] &&
      !journal.cleaned,
    'The journal does not identify the current owned official PDS.'
  );
  const inspect = async (id: string): Promise<Container> => {
    const rows = JSON.parse(await command(['inspect', id]));
    assert(rows.length === 1);
    return rows[0];
  };
  const container = await inspect(CONTAINER);
  assert(/^[a-f0-9]{64}$/.test(container.Id));
  const images = JSON.parse(await command(['image', 'inspect', IMAGE]));
  assert(images.length === 1 && images[0].Id === container.Image);
  assert(images[0].RepoDigests.includes(IMAGE));
  const validateContainer = (actual: Container) => {
    assert(
      actual.Id === container.Id &&
        actual.Image === container.Image &&
        actual.Config.Image === IMAGE &&
        actual.Config.Labels['dev.williecubed.website.acceptance'] ===
          journal.marker &&
        actual.State.Running &&
        !actual.State.Paused,
      'The owned PDS container identity or running state changed.'
    );
    const mounts = actual.Mounts.filter(
      (mount) => mount.Destination === '/pds'
    );
    assert(mounts.length === 1 && mounts[0].RW);
    assert(
      journal.storage?.active
        ? mounts[0].Type === 'volume' &&
            mounts[0].Name === journal.storage.volume
        : mounts[0].Type === 'bind' && mounts[0].Source === journal.data,
      'The owned PDS data mount changed.'
    );
  };
  validateContainer(container);
  if (journal.storage?.active) {
    const volumes = JSON.parse(
      await command(['volume', 'inspect', journal.storage.volume])
    );
    assert(
      volumes.length === 1 &&
        volumes[0].Labels['dev.williecubed.website.acceptance'] ===
          journal.marker,
      'The PDS volume does not carry the ownership marker.'
    );
  }
  const baseline: Receipt | undefined = options.baselinePath
    ? JSON.parse(await readFile(resolve(options.baselinePath), 'utf8'))
    : undefined;
  if (baseline) {
    assert(
      baseline.version === 1 &&
        baseline.canonicalClient === CLIENT &&
        baseline.containerId === container.Id &&
        baseline.image === IMAGE &&
        baseline.imageId === container.Image &&
        baseline.tokenCounts.length === DIDS.length &&
        baseline.tokenCounts.every((row, index) => row.did === DIDS[index]) &&
        Number.isSafeInteger(baseline.foreignTokens.count) &&
        baseline.foreignTokens.count >= 0 &&
        /^[a-f0-9]{64}$/.test(baseline.foreignTokens.sha256),
      'The foreign-token baseline belongs to another inventory.'
    );
  }
  const script = `import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
assert.equal(fs.readFileSync('/pds/.acceptance-owner','utf8'),${JSON.stringify(journal.marker)});
const dids=${JSON.stringify(DIDS)},client=${JSON.stringify(CLIENT)};
const db=new DatabaseSync('/pds/account.sqlite',{readOnly:true});
try{db.exec('BEGIN');
const tokenCounts=dids.map(did=>({did,tokens:db.prepare('SELECT COUNT(*) AS n FROM token WHERE did=? AND clientId=?').get(did,client).n}));
const hashes=[];for(const row of db.prepare('SELECT * FROM token WHERE NOT (clientId=? AND did IN (?,?))').iterate(client,...dids))hashes.push(createHash('sha256').update(JSON.stringify(row)).digest('hex'));
hashes.sort();const foreignTokens={count:hashes.length,sha256:createHash('sha256').update(JSON.stringify(hashes)).digest('hex')};
console.log(JSON.stringify({tokenCounts,foreignTokens}));}finally{db.close();}`;
  // Executing by the inspected ID prevents a replacement name from redirecting the query.
  const inventory: Inventory = JSON.parse(
    await command([
      'exec',
      container.Id,
      'node',
      '--input-type=module',
      '-e',
      script,
    ])
  );
  validateContainer(await inspect(CONTAINER));
  assert(
    inventory.tokenCounts.length === DIDS.length &&
      inventory.tokenCounts.every(
        (row, index) =>
          row.did === DIDS[index] &&
          Number.isSafeInteger(row.tokens) &&
          row.tokens >= 0
      ) &&
      Number.isSafeInteger(inventory.foreignTokens.count) &&
      inventory.foreignTokens.count >= 0 &&
      /^[a-f0-9]{64}$/.test(inventory.foreignTokens.sha256)
  );
  const foreignTokensPreserved = baseline
    ? baseline.foreignTokens.count === inventory.foreignTokens.count &&
      baseline.foreignTokens.sha256 === inventory.foreignTokens.sha256
    : undefined;
  const passed =
    inventory.tokenCounts.every((row) => row.tokens === 0) &&
    foreignTokensPreserved !== false;
  const receipt: Receipt = {
    version: 1,
    status: passed ? 'passed' : 'failed',
    checkedAt: new Date().toISOString(),
    method:
      'Official PDS account.sqlite token table; node:sqlite readOnly transaction',
    scope:
      'Current active token rows for the canonical acceptance client and two owned DIDs. authorized_client consent metadata is independent and is not required to be absent. This check does not prove an earlier revocation HTTP response.',
    canonicalClient: CLIENT,
    containerId: container.Id,
    image: IMAGE,
    imageId: container.Image,
    baselineCompared: Boolean(baseline),
    foreignTokensPreserved,
    ...inventory,
  };
  await writeFile(
    resolve(options.receiptPath),
    JSON.stringify(receipt, null, 2) + '\n',
    {
      mode: 0o600,
      flag: 'wx',
    }
  );
  assert(
    passed,
    'Owned provider tokens remain or the foreign-token baseline changed.'
  );
  return receipt;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({
    options: {
      journal: { type: 'string' },
      receipt: { type: 'string' },
      baseline: { type: 'string' },
    },
  });
  assert(
    values.journal && values.receipt,
    'Pass --journal and --receipt explicitly.'
  );
  await verifyProviderTokenInventory({
    journalPath: values.journal,
    receiptPath: values.receipt,
    baselinePath: values.baseline,
  });
  console.log('The owned-provider token inventory passed.');
}
