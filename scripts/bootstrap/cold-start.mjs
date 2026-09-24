#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ensureVariables } from './configuration.mjs';
import { parseArguments, selectedPhases } from './options.mjs';
import { ownerValues } from './owner.mjs';
import { parseEnvNames } from './readiness.mjs';
import {
  ensureBlob,
  ensureDatabase,
  ensurePublishingBranch,
  liveDeployment,
} from './resources.mjs';
import { linkedProject, parseProjectLink, targetProject } from './targets.mjs';

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(`${error.message}. Run pnpm bootstrap --help.`);
  process.exit(2);
}
const { doctor } = options;

if (options.help) {
  console.log(
    'pnpm bootstrap [--local-only] [--phase tools|workspace|env|auth|deployment] [--project website|indieweb-acceptance]'
  );
  console.log(
    'pnpm preflight [--local-only] [--project website|indieweb-acceptance]'
  );
  process.exit(0);
}

function command(program, argv, quiet = true, env = process.env, input) {
  const result = spawnSync(program, argv, {
    encoding: 'utf8',
    stdio: quiet ? 'pipe' : 'inherit',
    env,
    input,
  });
  return { ok: result.status === 0, stdout: result.stdout ?? '' };
}

function provider(program, argv, options = {}) {
  return command(
    program,
    argv,
    true,
    options.env ?? process.env,
    options.input
  );
}

function line(ok, label, detail) {
  console.log(`${ok ? '✓' : '✗'} ${label}: ${detail}`);
  return ok;
}

function tools() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const pnpm = command('pnpm', ['--version']);
  let ok = line(
    nodeMajor >= 24,
    'Node',
    `${process.versions.node} (requires >=24)`
  );
  ok =
    line(
      pnpm.ok &&
        `pnpm@${pnpm.stdout.trim()}` ===
          packageJson.packageManager.split('+')[0],
      'pnpm',
      pnpm.ok ? pnpm.stdout.trim() : 'missing'
    ) && ok;
  return ok;
}

function workspace() {
  if (doctor && !existsSync('node_modules/.pnpm')) {
    return line(false, 'Dependencies', 'missing; run pnpm bootstrap');
  }
  if (!doctor) {
    console.log('Installing the pinned dependency tree.');
    if (!command('pnpm', ['install', '--frozen-lockfile'], false).ok)
      return false;
  }
  console.log('Running the repository checks.');
  return line(
    command('pnpm', ['check'], false, {
      ...process.env,
      INDIEWEB_POSTBUILD: '0',
    }).ok,
    'Workspace',
    'pnpm check'
  );
}

function env() {
  const target = '.env.local';
  if (existsSync(target)) return line(true, target, 'exists; left untouched');
  if (doctor)
    return line(false, target, 'missing; pnpm bootstrap copies .env.example');
  copyFileSync('.env.example', target);
  return line(true, target, 'created from .env.example');
}

function auth() {
  const gh = command('gh', ['auth', 'status']);
  const vercel = command('vercel', ['whoami']);
  const neon = command('neon', ['me', '--output', 'json']);
  const psql = command('psql', ['--version']);
  const curl = command('curl', ['--version']);
  const ok = line(
    gh.ok,
    'GitHub CLI',
    gh.ok ? 'signed in' : 'run gh auth login'
  );
  const vercelReady = line(
    vercel.ok,
    'Vercel CLI',
    vercel.ok ? 'signed in' : 'run vercel login'
  );
  const neonReady = line(
    neon.ok,
    'Neon CLI',
    neon.ok ? 'signed in' : 'run neon auth'
  );
  const psqlReady = line(
    psql.ok,
    'psql',
    psql.ok ? 'installed' : 'install PostgreSQL client tools'
  );
  const curlReady = line(
    curl.ok,
    'curl',
    curl.ok ? 'installed' : 'install curl'
  );
  return ok && vercelReady && neonReady && psqlReady && curlReady;
}

function redeploy(target) {
  const listed = provider('vercel', [
    'ls',
    target.projectName,
    '--environment',
    'production',
    '--limit',
    '1',
    '--json',
    '--scope',
    'williecubed-projects',
  ]);
  if (!listed.ok) return false;
  let previous;
  try {
    previous = JSON.parse(listed.stdout).deployments?.[0]?.url;
  } catch {
    return false;
  }
  if (previous) {
    return command(
      'vercel',
      [
        'redeploy',
        previous,
        '--target',
        'production',
        '--scope',
        'williecubed-projects',
      ],
      false
    ).ok;
  }
  const branch = provider('git', ['branch', '--show-current']);
  if (!branch.ok || branch.stdout.trim() !== target.branch) {
    console.error(`A first deployment must run from ${target.branch}.`);
    return false;
  }
  return command(
    'vercel',
    ['deploy', '--prod', '--yes', '--scope', 'williecubed-projects'],
    false
  ).ok;
}

async function deployment() {
  const link = join('.vercel', 'project.json');
  let linked = existsSync(link)
    ? linkedProject(parseProjectLink(readFileSync(link, 'utf8')))
    : null;
  if (existsSync(link) && !linked) {
    return line(
      false,
      'Vercel project',
      'the link has the wrong project or team ID'
    );
  }
  if (!linked && !doctor) {
    const target = targetProject(options.project ?? 'indieweb-acceptance');
    const result = command(
      'vercel',
      ['link', '--yes', '--team', target.orgId, '--project', target.projectId],
      false
    );
    if (!result.ok)
      return line(false, 'Vercel project', 'could not link the project');
    linked = existsSync(link)
      ? linkedProject(parseProjectLink(readFileSync(link, 'utf8')))
      : null;
  }
  if (!linked)
    return line(
      false,
      'Vercel project',
      'not linked; run pnpm bootstrap to link acceptance'
    );
  if (options.project && linked !== options.project)
    return line(
      false,
      'Vercel project',
      `linked to ${linked}; expected ${options.project}. Refusing to inspect the wrong deployment`
    );
  console.log(`✓ Vercel project: ${linked}`);
  const target = targetProject(linked);
  const response = provider('vercel', [
    'env',
    'ls',
    'production',
    '--json',
    '--scope',
    'williecubed-projects',
  ]);
  if (!response.ok)
    return line(false, 'Vercel environment', 'could not list variables');
  let names;
  try {
    names = parseEnvNames(response.stdout);
  } catch {
    return line(false, 'Vercel environment', 'unexpected response');
  }
  const gh = provider('gh', [
    'secret',
    'list',
    '--repo',
    'WillieCubed/website',
    '--json',
    'name',
  ]);
  if (!gh.ok)
    return line(
      false,
      'GitHub secrets',
      'could not inspect repository secrets'
    );
  let secrets;
  try {
    secrets = new Set(JSON.parse(gh.stdout).map((item) => item.name));
  } catch {
    return line(false, 'GitHub secrets', 'unexpected response');
  }
  let values = process.env;
  if (!doctor) {
    try {
      values = await ownerValues(target, names);
    } catch (error) {
      return line(false, 'Owner credentials', error.message);
    }
    const credentials = ensureVariables({
      target,
      doctor: false,
      names,
      githubSecrets: secrets,
      connectionString: '',
      values,
      run: (program, args, options) => {
        if (program === 'gh') return provider(program, args, options);
        return { ok: false, stdout: '' };
      },
      validateOnly: true,
    });
    if (
      !line(
        credentials.ok,
        'Owner credentials',
        credentials.ok ? 'available' : credentials.reason
      )
    )
      return false;
  }
  const database = ensureDatabase(target, doctor, provider);
  if (
    !line(
      database.ok,
      'Neon database',
      database.ok ? `${target.neonName} schema ready` : database.reason
    )
  )
    return false;
  const blob = ensureBlob(target, doctor, provider);
  if (
    !line(
      blob.ok,
      'Blob storage',
      blob.ok ? `${target.blobName} connected` : blob.reason
    )
  )
    return false;
  const publishing = ensurePublishingBranch(target, doctor, provider);
  if (
    !line(
      publishing.ok,
      'Publishing branch',
      publishing.ok ? target.branch : publishing.reason
    )
  )
    return false;
  const configured = ensureVariables({
    target,
    doctor,
    names,
    githubSecrets: secrets,
    connectionString: database.connectionString,
    values,
    run: provider,
  });
  if (
    !line(
      configured.ok,
      'Deployment configuration',
      configured.ok ? 'required settings present' : configured.reason
    )
  )
    return false;
  if (linked === 'website')
    console.log('○ Production notifications: pending content approval');
  if (
    !doctor &&
    (database.changed ||
      blob.changed ||
      publishing.changed ||
      configured.changed)
  ) {
    if (
      !line(
        redeploy(target),
        'Vercel deployment',
        'redeploy after configuration'
      )
    )
      return false;
  }
  const live = liveDeployment(target, provider);
  return line(
    live.ok,
    'Public deployment',
    live.ok ? `serves ${live.revision}` : live.reason
  );
}

const runners = {
  tools,
  workspace,
  env,
  auth,
  deployment,
};
let failed = false;
for (const phase of selectedPhases(options)) {
  console.log(`\n${phase.toUpperCase()}`);
  const ok = await runners[phase]();
  if (!ok) {
    failed = true;
    if (!doctor) break;
  }
}
if (failed) {
  console.error(
    `\n${doctor ? 'Preflight found missing setup.' : 'Bootstrap stopped.'} Fix the failed step and rerun.`
  );
  process.exit(1);
}
console.log(`\n${doctor ? 'Preflight passed.' : 'Bootstrap complete.'}`);
