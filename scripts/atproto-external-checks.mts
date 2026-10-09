import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const ORIGIN = 'https://indieweb-acceptance.vercel.app';
type WorkflowJournal =
  | 'publishing-notification-workflow.json'
  | 'final-notification-workflow.json';
interface WorkflowRun {
  databaseId: number;
  headSha: string;
  headBranch?: string;
  event?: string;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
  updatedAt?: string;
}
interface WorkflowReceipt {
  version: 1;
  origin: string;
  did: string;
  branch: string;
  sha: string;
  started: string;
  run?: WorkflowRun;
  status: 'pending' | 'passed';
  quiesced: boolean;
  terminalObservedAt?: string;
  atproto?: string;
  subscriberReceipt: 'not-established';
  trigger: 'workflow_dispatch';
}
async function saveWorkflow(path: string, receipt: WorkflowReceipt) {
  await writeFile(path, JSON.stringify(receipt, null, 2) + '\n', {
    mode: 0o600,
  });
  await chmod(path, 0o600);
}
function ghJson<T>(workspace: string, args: string[]): T {
  return JSON.parse(
    execFileSync('gh', [...args, '--repo', 'WillieCubed/website'], {
      cwd: workspace,
      encoding: 'utf8',
      stdio: 'pipe',
    })
  ) as T;
}
function workflowRuns(workspace: string, receipt: WorkflowReceipt) {
  return ghJson<WorkflowRun[]>(workspace, [
    'run',
    'list',
    '--branch',
    receipt.branch,
    '--workflow',
    'indieweb-publish.yml',
    '--event',
    'workflow_dispatch',
    '--limit',
    '10',
    '--json',
    'databaseId,headSha,status,conclusion,url,createdAt',
  ]);
}
export async function recoverNotificationWorkflow(
  output: string,
  workspace: string,
  journal: WorkflowJournal = 'publishing-notification-workflow.json'
) {
  const path = resolve(output, journal);
  let receipt: WorkflowReceipt;
  try {
    receipt = JSON.parse(await readFile(path, 'utf8')) as WorkflowReceipt;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  assert(
    receipt.version === 1 &&
      receipt.origin === ORIGIN &&
      receipt.did === process.env.NEXT_PUBLIC_ATPROTO_DID &&
      receipt.did !== 'did:plc:iyn6nc3ffqm2e3555exyrgvv'
  );
  assert(
    /^codex\/publishing-compatibility-acceptance(?:-\d{8})?$/.test(
      receipt.branch
    ) &&
      /^[a-f0-9]{40}$/.test(receipt.sha) &&
      Number.isFinite(Date.parse(receipt.started))
  );
  assert(
    execFileSync('git', ['branch', '--show-current'], {
      cwd: workspace,
      encoding: 'utf8',
    }).trim() === receipt.branch
  );
  if (receipt.quiesced)
    assert(receipt.terminalObservedAt && receipt.run?.status === 'completed');
  const deadline = Date.now() + 120000;
  do {
    if (receipt.quiesced) break;
    if (!receipt.run)
      receipt.run = workflowRuns(workspace, receipt).find(
        (run) =>
          run.headSha === receipt.sha &&
          Date.parse(run.createdAt) >= Date.parse(receipt.started) - 1000
      );
    if (receipt.run) {
      const run = ghJson<WorkflowRun>(workspace, [
        'run',
        'view',
        String(receipt.run.databaseId),
        '--json',
        'databaseId,headSha,headBranch,event,status,conclusion,url,createdAt',
      ]);
      assert(
        run.headSha === receipt.sha &&
          run.headBranch === receipt.branch &&
          run.event === 'workflow_dispatch' &&
          Date.parse(run.createdAt) >= Date.parse(receipt.started) - 1000
      );
      receipt.run = run;
      await saveWorkflow(path, receipt);
      if (run.status === 'completed') break;
      execFileSync(
        'gh',
        [
          'run',
          'cancel',
          String(run.databaseId),
          '--repo',
          'WillieCubed/website',
        ],
        { cwd: workspace, stdio: 'pipe' }
      );
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5000));
  } while (Date.now() < deadline);
  assert(
    receipt.run?.status === 'completed',
    'Workflow state is unknown. Preserve all owned PDS/source records until recovery establishes a terminal run.'
  );
  const allRuns = ghJson<WorkflowRun[]>(workspace, [
    'run',
    'list',
    '--branch',
    receipt.branch,
    '--workflow',
    'indieweb-publish.yml',
    '--limit',
    '100',
    '--json',
    'databaseId,headSha,status,conclusion,url,createdAt,updatedAt',
  ]);
  assert(
    allRuns.every((run) => run.status === 'completed'),
    'Another acceptance branch notification job is active. Preserve the fixture until it finishes.'
  );
  assert(
    allRuns.every(
      (run) => run.updatedAt && Number.isFinite(Date.parse(run.updatedAt))
    )
  );
  if (
    receipt.quiesced &&
    allRuns.every(
      (run) =>
        Date.parse(run.updatedAt!) <= Date.parse(receipt.terminalObservedAt!)
    )
  )
    return;
  receipt.quiesced = false;
  receipt.terminalObservedAt = new Date().toISOString();
  await saveWorkflow(path, receipt);
  // Cancellation does not stop an HTTP handler that GitHub already invoked; its deployed limit is 60 seconds.
  const drainedAt = Date.parse(receipt.terminalObservedAt) + 70000;
  while (Date.now() < drainedAt)
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, Math.min(5000, drainedAt - Date.now()))
    );
  const afterDrain = ghJson<WorkflowRun[]>(workspace, [
    'run',
    'list',
    '--branch',
    receipt.branch,
    '--workflow',
    'indieweb-publish.yml',
    '--limit',
    '100',
    '--json',
    'databaseId,headSha,status,conclusion,url,createdAt,updatedAt',
  ]);
  assert(
    afterDrain.every(
      (run) =>
        run.status === 'completed' &&
        run.updatedAt &&
        Date.parse(run.updatedAt) <= Date.parse(receipt.terminalObservedAt!)
    ),
    'An acceptance notification job changed during the drain. Preserve the fixture and retry recovery.'
  );
  receipt.quiesced = true;
  await saveWorkflow(path, receipt);
}
export async function externalChecks(
  output: string,
  workspace: string,
  documentUrl = ORIGIN
) {
  assert.equal(new URL(documentUrl).origin, ORIGIN);
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    console.log(
      'Step 7: Validate the hosted writing through the independent Standard.site validator while its real PDS document remains available.'
    );
    console.log(
      `Open https://site-validator.fly.dev/ and validate ${documentUrl}. Use permitted browser access; never bypass a denied browser policy.`
    );
    const outcome = (
      await terminal.question(
        'Enter passed, failed, or pending from the independent result: '
      )
    ).trim();
    assert(['passed', 'failed', 'pending'].includes(outcome));
    const runUrl = (
      await terminal.question(
        'Paste its public run URL, or press Enter if none exists: '
      )
    ).trim();
    if (runUrl) {
      const url = new URL(runUrl);
      assert(url.protocol === 'https:' && !url.username && !url.password);
    }
    const exported = (
      await terminal.question(
        'Enter an exported result file path, or press Enter if none exists: '
      )
    ).trim();
    let evidence: string | undefined;
    if (exported) {
      evidence = await readFile(resolve(exported), 'utf8');
      assert(Buffer.byteLength(evidence) <= 1048576);
    }
    const path = resolve(output, 'standard-independent-validator.json');
    await writeFile(
      path,
      JSON.stringify(
        {
          version: 1,
          origin: ORIGIN,
          documentUrl,
          observedAt: new Date().toISOString(),
          provenance:
            'The operator supplied a reported independent result. The helper did not access the validator or verify the report.',
          reportedOutcome: outcome,
          runUrl: runUrl || undefined,
          exportedResult: evidence,
          status:
            outcome === 'pending' ? 'pending' : 'operator-reported-unverified',
          independentValidatorVerified: false,
        },
        null,
        2
      ) + '\n',
      { mode: 0o600 }
    );
    await chmod(path, 0o600);
    console.log(
      'The supplied validator report remains unverified until its independent result is reviewed.'
    );
  } finally {
    terminal.close();
  }
  console.log(
    'Step 8: Dispatch and inspect the actual isolated branch publishing-notification workflow. A successful job does not prove subscriber receipt.'
  );
  await checkNotificationWorkflow(output, workspace);
}
export async function checkNotificationWorkflow(
  output: string,
  workspace: string,
  journal: WorkflowJournal = 'publishing-notification-workflow.json'
) {
  const existing = resolve(output, journal);
  try {
    await readFile(existing, 'utf8');
    await recoverNotificationWorkflow(output, workspace, journal);
    const previous = JSON.parse(
      await readFile(existing, 'utf8')
    ) as WorkflowReceipt;
    assert(
      previous.status === 'passed' && previous.atproto === 'synced',
      'A recovered terminal workflow did not establish a passed sync result.'
    );
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const branch = execFileSync('git', ['branch', '--show-current'], {
    cwd: workspace,
    encoding: 'utf8',
  }).trim();
  assert(
    /^codex\/publishing-compatibility-acceptance(?:-\d{8})?$/.test(branch)
  );
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspace,
    encoding: 'utf8',
  }).trim();
  const revision = await fetch(`${ORIGIN}/api/indieweb/revision`, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  assert(
    revision.ok && (await revision.json()).sha === sha,
    'The hosted deployment must match this exact acceptance commit.'
  );
  const path = resolve(output, journal);
  await assert.rejects(
    readFile(path, 'utf8'),
    (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT',
    'Refuse to overwrite an earlier workflow journal.'
  );
  const receipt: WorkflowReceipt = {
    version: 1,
    origin: ORIGIN,
    did: process.env.NEXT_PUBLIC_ATPROTO_DID!,
    branch,
    sha,
    started: new Date().toISOString(),
    status: 'pending',
    quiesced: false,
    subscriberReceipt: 'not-established',
    trigger: 'workflow_dispatch',
  };
  await saveWorkflow(path, receipt);
  try {
    execFileSync(
      'gh',
      [
        'workflow',
        'run',
        'indieweb-publish.yml',
        '--repo',
        'WillieCubed/website',
        '--ref',
        branch,
      ],
      { cwd: workspace, stdio: 'pipe' }
    );
    const deadline = Date.now() + 900000;
    do {
      receipt.run = workflowRuns(workspace, receipt).find(
        (run) =>
          run.headSha === sha &&
          Date.parse(run.createdAt) >= Date.parse(receipt.started) - 1000
      );
      await saveWorkflow(path, receipt);
      if (receipt.run?.status === 'completed') break;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5000));
    } while (Date.now() < deadline);
    assert(
      receipt.run?.status === 'completed' &&
        receipt.run.conclusion === 'success',
      'The actual acceptance workflow did not pass.'
    );
    const logs = execFileSync(
      'gh',
      [
        'run',
        'view',
        String(receipt.run.databaseId),
        '--repo',
        'WillieCubed/website',
        '--log',
      ],
      { cwd: workspace, encoding: 'utf8', stdio: 'pipe' }
    );
    assert(
      /"atproto"\s*:\s*\{\s*"status"\s*:\s*"synced"/.test(logs),
      'The workflow must report an actual synced publication.'
    );
    receipt.status = 'passed';
    receipt.atproto = 'synced';
    await saveWorkflow(path, receipt);
  } finally {
    await recoverNotificationWorkflow(output, workspace, journal);
  }
  console.log(
    'The actual branch notification workflow reports synced. Subscriber receipt remains a separate WebSub check.'
  );
}

export async function verifyAcceptanceVideoAccount() {
  const did = process.env.NEXT_PUBLIC_ATPROTO_DID;
  assert(
    did &&
      did !== 'did:plc:iyn6nc3ffqm2e3555exyrgvv' &&
      process.env.ATPROTO_APP_PASSWORD
  );
  const [{ Client, ok }, { PasswordSession }, { resolvePds }] =
    await Promise.all([
      import('@atcute/client'),
      import('@atcute/password-session'),
      import('../lib/atproto/identity'),
    ]);
  const session = await PasswordSession.login({
    service: await resolvePds(did as import('@atcute/lexicons').Did),
    identifier: did,
    password: process.env.ATPROTO_APP_PASSWORD!,
  });
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    assert(session.did === did);
    const client = new Client({ handler: session });
    console.log(
      'Step 2.1: Check the actual account email status before real Atmosphere video publishing.'
    );
    while (true) {
      const account = await ok(client.get('com.atproto.server.getSession', {}));
      if (account.emailConfirmed !== false) {
        console.log('The PDS account does not report an unverified email.');
        break;
      }
      console.log(
        'Open https://bsky.app/settings/account in your own browser and finish email verification for the isolated account.'
      );
      await terminal.question(
        'After email verification, press Enter to recheck the actual PDS status: '
      );
    }
  } finally {
    terminal.close();
    await session.logout();
  }
}
