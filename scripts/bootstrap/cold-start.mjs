#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  checkDeployment,
  parseEnvNames,
  parseProjectName,
} from './readiness.mjs';

const phases = ['tools', 'workspace', 'env', 'auth', 'deployment'];
const args = process.argv.slice(2);
const doctor = args.includes('--doctor');
const localOnly = args.includes('--local-only');
const selected = args.includes('--phase')
  ? args[args.indexOf('--phase') + 1]
  : undefined;
const projectArg = args.includes('--project')
  ? args[args.indexOf('--project') + 1]
  : undefined;

if (args.includes('--help')) {
  console.log(
    'pnpm bootstrap [--local-only] [--phase tools|workspace|env|auth|deployment] [--project website|indieweb-acceptance]'
  );
  console.log(
    'pnpm preflight [--local-only] [--project website|indieweb-acceptance]'
  );
  process.exit(0);
}
if (
  (args.includes('--phase') && (!selected || !phases.includes(selected))) ||
  (args.includes('--project') &&
    projectArg !== 'website' &&
    projectArg !== 'indieweb-acceptance')
) {
  console.error('Unknown phase or project. Run pnpm bootstrap --help.');
  process.exit(2);
}

function command(program, argv, quiet = true, env = process.env) {
  const result = spawnSync(program, argv, {
    encoding: 'utf8',
    stdio: quiet ? 'pipe' : 'inherit',
    env,
  });
  return { ok: result.status === 0, stdout: result.stdout ?? '' };
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
  if (doctor)
    return line(
      existsSync('node_modules/.pnpm'),
      'Dependencies',
      existsSync('node_modules/.pnpm') ? 'installed' : 'run pnpm bootstrap'
    );
  console.log('Installing the pinned dependency tree.');
  if (!command('pnpm', ['install', '--frozen-lockfile'], false).ok)
    return false;
  console.log('Running the repository checks.');
  return command('pnpm', ['check'], false, {
    ...process.env,
    INDIEWEB_POSTBUILD: '0',
  }).ok;
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
  const ok = line(
    gh.ok,
    'GitHub CLI',
    gh.ok ? 'signed in' : 'run gh auth login'
  );
  return (
    line(
      vercel.ok,
      'Vercel CLI',
      vercel.ok ? 'signed in' : 'run vercel login'
    ) && ok
  );
}

function deployment() {
  const link = join('.vercel', 'project.json');
  const linked = existsSync(link)
    ? parseProjectName(readFileSync(link, 'utf8'))
    : null;
  if (!linked)
    return line(
      false,
      'Vercel project',
      'not linked to website or indieweb-acceptance; run vercel link for the intended project'
    );
  if (projectArg && linked !== projectArg)
    return line(
      false,
      'Vercel project',
      `linked to ${linked}; expected ${projectArg}. Refusing to inspect the wrong deployment`
    );
  console.log(`✓ Vercel project: ${linked}`);
  const response = command('vercel', [
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
  const { missing, pending } = checkDeployment(names, linked);
  for (const name of missing)
    line(false, 'Vercel environment', `${name} is missing`);
  for (const name of pending)
    console.log(`○ GitHub ${name}: pending content approval`);
  const gh = command('gh', [
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
  try {
    const secrets = new Set(JSON.parse(gh.stdout).map((item) => item.name));
    const required =
      linked === 'website' ? [] : ['INDIEWEB_NOTIFY_SECRET_ACCEPTANCE'];
    for (const name of required)
      if (!secrets.has(name)) missing.push(`GitHub ${name}`);
  } catch {
    return line(false, 'GitHub secrets', 'unexpected response');
  }
  return line(
    missing.length === 0,
    'Deployment readiness',
    missing.length === 0
      ? 'required names are configured'
      : `${missing.length} required setting(s) missing`
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
for (const phase of phases) {
  if (selected && phase !== selected) continue;
  if (localOnly && (phase === 'auth' || phase === 'deployment')) continue;
  console.log(`\n${phase.toUpperCase()}`);
  const ok = runners[phase]();
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
