export function parseProjectName(json) {
  try {
    const name = JSON.parse(json).projectName;
    return name === 'website' || name === 'indieweb-acceptance' ? name : null;
  } catch {
    return null;
  }
}

export function parseEnvNames(json) {
  const parsed = JSON.parse(json);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('envs' in parsed) ||
    !Array.isArray(parsed.envs)
  ) {
    throw new Error('Vercel did not return an environment list');
  }
  return new Set(
    parsed.envs.flatMap((env) =>
      env &&
      typeof env === 'object' &&
      'key' in env &&
      typeof env.key === 'string'
        ? [env.key]
        : []
    )
  );
}

export function checkDeployment(env, project) {
  const required = [
    'POSTGRES_URL',
    'WEBMENTION_SECRET',
    'WEBMENTION_MODERATION_SECRET',
    'INDIEAUTH_TOTP_SECRET',
    'INDIEAUTH_INTROSPECTION_SECRET',
    'MICROPUB_GITHUB_REPO',
    'MICROPUB_GITHUB_TOKEN',
    'MICROPUB_GITHUB_BRANCH',
    'INDIEWEB_NOTIFY_SECRET',
  ];
  const missing = required.filter((name) => !env.has(name));
  if (
    project === 'indieweb-acceptance' &&
    !env.has('NEXT_PUBLIC_SITE_ORIGIN')
  ) {
    missing.push('NEXT_PUBLIC_SITE_ORIGIN');
  }
  if (!env.has('BLOB_STORE_ID') && !env.has('BLOB_READ_WRITE_TOKEN')) {
    missing.push('BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN');
  }
  // Production publication still needs Willie's editorial approval. The
  // workflow secret intentionally stays absent until that review finishes.
  const pending =
    project === 'website' ? ['INDIEWEB_NOTIFY_SECRET_PRODUCTION'] : [];
  return { missing, pending };
}
