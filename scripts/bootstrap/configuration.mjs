import { randomBytes } from 'node:crypto';

import { checkDeployment } from './readiness.mjs';

const REPO = 'WillieCubed/website';
const SCOPE = 'williecubed-projects';

function addVercelVariable(run, target, name, value, secret, replace = false) {
  const args = [
    'env',
    'add',
    name,
    'production',
    '--project',
    target.projectId,
    '--scope',
    SCOPE,
    '--yes',
    secret ? '--sensitive' : '--no-sensitive',
  ];
  if (replace) args.push('--force');
  return run('vercel', args, { input: `${value}\n` }).ok;
}

function configuredValues(target, connectionString, values) {
  return {
    POSTGRES_URL: connectionString,
    WEBMENTION_SECRET: randomBytes(32).toString('hex'),
    WEBMENTION_MODERATION_SECRET: randomBytes(32).toString('hex'),
    INDIEAUTH_INTROSPECTION_SECRET: randomBytes(32).toString('hex'),
    INDIEWEB_NOTIFY_SECRET: randomBytes(32).toString('hex'),
    INDIEAUTH_TOTP_SECRET: values.INDIEAUTH_TOTP_SECRET,
    MICROPUB_GITHUB_TOKEN: values.MICROPUB_GITHUB_TOKEN,
    MICROPUB_GITHUB_REPO: REPO,
    MICROPUB_GITHUB_BRANCH: target.branch,
    NEXT_PUBLIC_SITE_ORIGIN: target.origin,
  };
}

export function ensureVariables({
  target,
  doctor,
  names,
  githubSecrets,
  connectionString,
  values,
  run,
  validateOnly = false,
}) {
  const current = new Set(names);
  const githubName = 'INDIEWEB_NOTIFY_SECRET_ACCEPTANCE';
  const needsGithub =
    target.projectName === 'indieweb-acceptance' &&
    !githubSecrets.has(githubName);
  const missing = checkDeployment(current, target.projectName).missing;
  if (doctor) {
    if (needsGithub) missing.push(`GitHub ${githubName}`);
    return missing.length
      ? { ok: false, reason: `${missing.join(', ')} missing`, changed: false }
      : { ok: true, changed: false };
  }

  const neededOwnerValues = [
    'INDIEAUTH_TOTP_SECRET',
    'MICROPUB_GITHUB_TOKEN',
  ].filter((name) => !current.has(name) && !values[name]);
  if (neededOwnerValues.length) {
    return {
      ok: false,
      reason: `${neededOwnerValues.join(' and ')} must be supplied to finish setup`,
      changed: false,
    };
  }
  if (
    !current.has('INDIEAUTH_TOTP_SECRET') &&
    !/^[A-Z2-7]{16,}$/.test(values.INDIEAUTH_TOTP_SECRET)
  ) {
    return {
      ok: false,
      reason: 'INDIEAUTH_TOTP_SECRET must be a base32 secret',
      changed: false,
    };
  }
  if (!current.has('MICROPUB_GITHUB_TOKEN')) {
    const permission = run(
      'gh',
      ['api', `repos/${REPO}`, '--jq', '.permissions.push'],
      {
        env: { ...process.env, GH_TOKEN: values.MICROPUB_GITHUB_TOKEN },
      }
    );
    if (!permission.ok || permission.stdout.trim() !== 'true') {
      return {
        ok: false,
        reason:
          'MICROPUB_GITHUB_TOKEN cannot write to the publishing repository',
        changed: false,
      };
    }
  }
  if (validateOnly) return { ok: true, changed: false };
  const desired = configuredValues(target, connectionString, values);
  let changed = false;
  if (needsGithub) {
    const secret = desired.INDIEWEB_NOTIFY_SECRET;
    if (
      !addVercelVariable(
        run,
        target,
        'INDIEWEB_NOTIFY_SECRET',
        secret,
        true,
        current.has('INDIEWEB_NOTIFY_SECRET')
      )
    ) {
      return {
        ok: false,
        reason: 'could not set the acceptance notification secret in Vercel',
        changed,
      };
    }
    current.add('INDIEWEB_NOTIFY_SECRET');
    const github = run('gh', ['secret', 'set', githubName, '--repo', REPO], {
      input: `${secret}\n`,
    });
    if (!github.ok)
      return {
        ok: false,
        reason: 'could not set the matching GitHub notification secret',
        changed: true,
      };
    changed = true;
  }
  const secretNames = new Set([
    'POSTGRES_URL',
    'WEBMENTION_SECRET',
    'WEBMENTION_MODERATION_SECRET',
    'INDIEAUTH_INTROSPECTION_SECRET',
    'INDIEWEB_NOTIFY_SECRET',
    'INDIEAUTH_TOTP_SECRET',
    'MICROPUB_GITHUB_TOKEN',
  ]);
  for (const [name, value] of Object.entries(desired)) {
    if (current.has(name)) continue;
    if (!addVercelVariable(run, target, name, value, secretNames.has(name))) {
      return { ok: false, reason: `could not set ${name} in Vercel`, changed };
    }
    current.add(name);
    changed = true;
  }
  return { ok: true, changed, names: current };
}
