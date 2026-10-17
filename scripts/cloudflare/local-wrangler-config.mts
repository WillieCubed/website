import type { SpawnSyncReturns } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import cloudflareConfig from '../../cloudflare.config.ts';
import wranglerConfigExport from '../../wrangler.config.ts';

type Binding = { type: string } & Record<string, unknown>;
type Entry = Record<string, unknown>;

interface LocalBindings {
  vars: Record<string, unknown>;
  hyperdrive: Entry[];
  r2_buckets: Entry[];
  ratelimits: Entry[];
  services: Entry[];
  durable_objects: { bindings: Entry[] };
  images?: Entry;
}

// Wrangler bundles and serves Hyperdrive bindings locally only with a
// connection string; a placeholder is enough when nothing queries it. A
// non-empty `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>` still
// takes precedence, without its credentials being written to this file.
const LOCAL_HYPERDRIVE_URL =
  'postgresql://preview:preview@127.0.0.1:5432/preview';

// Secrets have no entry: a local preview reads them from `.dev.vars`.
// The assets binding is placed with its directory below.
const translators: Partial<
  Record<
    string,
    (
      bindings: LocalBindings,
      name: string,
      binding: Binding,
      workerName: string
    ) => void
  >
> = {
  text: (bindings, name, { value }) => {
    bindings.vars[name] = value;
  },
  secret: () => undefined,
  assets: () => undefined,
  hyperdrive: (bindings, name, { id }) => {
    bindings.hyperdrive.push({
      binding: name,
      id,
      localConnectionString: LOCAL_HYPERDRIVE_URL,
    });
  },
  r2: (bindings, name, binding) => {
    bindings.r2_buckets.push({ binding: name, bucket_name: binding.name });
  },
  'rate-limit': (bindings, name, { namespace, simple }) => {
    bindings.ratelimits.push({ name, namespace_id: namespace, simple });
  },
  worker: (bindings, name, { worker }) => {
    bindings.services.push({ binding: name, service: worker });
  },
  'durable-object': (bindings, name, { exportName, worker }, workerName) => {
    bindings.durable_objects.bindings.push({
      name,
      class_name: exportName,
      ...(worker === workerName ? {} : { script_name: worker }),
    });
  },
  images: (bindings, name) => {
    bindings.images = { binding: name };
  },
};

function translateBindings(
  env: Record<string, unknown>,
  workerName: string,
  skipUntranslated: boolean
): LocalBindings {
  const bindings: LocalBindings = {
    vars: {},
    hyperdrive: [],
    r2_buckets: [],
    ratelimits: [],
    services: [],
    durable_objects: { bindings: [] },
  };
  for (const [name, value] of Object.entries(env)) {
    const binding = value as Binding;
    const translate = translators[binding.type];
    if (translate) {
      translate(bindings, name, binding, workerName);
    } else if (!skipUntranslated) {
      throw new Error(
        `${name} uses the ${binding.type} binding, which the local Wrangler config does not translate yet.`
      );
    }
  }
  return bindings;
}

// Worker settings the translation below covers. Domains and triggers are
// left out on purpose; any other field fails the translation rather than
// being silently dropped.
const TRANSLATED_WORKER_FIELDS = new Set([
  'name',
  'compatibilityDate',
  'compatibilityFlags',
  'entrypoint',
  'assets',
  'domains',
  'triggers',
  'env',
  'exports',
  'workersDev',
  'previewUrls',
  'observability',
]);
const TRANSLATED_ASSETS_FIELDS = new Set([
  'htmlHandling',
  'notFoundHandling',
  'runWorkerFirst',
]);

/**
 * Splits Durable Object exports into the classes a first migration creates.
 * Renamed, deleted, and transferred classes, and other export types, are
 * reported as untranslated.
 */
function durableObjectMigration(workerExports: Record<string, unknown>) {
  const sqlite: string[] = [];
  const kv: string[] = [];
  const untranslated: string[] = [];
  for (const [name, value] of Object.entries(workerExports)) {
    const entry = value as Binding;
    const created =
      entry.type === 'durable-object' && entry.state === undefined;
    if (created && entry.storage === 'sqlite') sqlite.push(name);
    else if (created && entry.storage === 'legacy-kv') kv.push(name);
    else untranslated.push(name);
  }
  return {
    classes: {
      new_sqlite_classes: sqlite,
      ...(kv.length > 0 ? { new_classes: kv } : {}),
    },
    untranslated,
  };
}

/**
 * Translates the Worker and bundler configuration into the Wrangler JSON
 * that OpenNext's commands still require, so the TypeScript configuration
 * stays the only source of Worker settings.
 *
 * Routes and custom domains are left out: a local preview serves its
 * loopback hostname, and the configured domains redirect to production.
 */
async function localWranglerConfig({
  mode,
  skipUntranslated = false,
}: LocalWranglerConfigOptions) {
  const { accountId, worker } = await cloudflareConfig({
    isPreview: false,
    mode,
  });
  const tooling = await wranglerConfigExport;
  if (typeof tooling === 'function') {
    throw new Error(
      'The local Wrangler config expects a static bundler config.'
    );
  }
  const env: Record<string, unknown> = worker.env ?? {};
  const assetsBinding = Object.entries(env).find(
    ([, value]) => (value as Binding).type === 'assets'
  )?.[0];
  const assets: Record<string, unknown> =
    (worker as { assets?: Record<string, unknown> }).assets ?? {};
  const migration = durableObjectMigration(worker.exports ?? {});
  const untranslated = [
    ...Object.keys(worker).filter((key) => !TRANSLATED_WORKER_FIELDS.has(key)),
    ...Object.keys(assets)
      .filter((key) => !TRANSLATED_ASSETS_FIELDS.has(key))
      .map((key) => `assets.${key}`),
    ...migration.untranslated.map((name) => `exports.${name}`),
  ];
  if (untranslated.length > 0 && !skipUntranslated) {
    throw new Error(
      `The local Wrangler config does not translate ${untranslated.join(', ')} yet.`
    );
  }

  return {
    account_id: accountId,
    name: worker.name,
    main: worker.entrypoint,
    base_dir: tooling.baseDir,
    find_additional_modules: tooling.findAdditionalModules,
    rules: tooling.rules,
    compatibility_date: worker.compatibilityDate,
    compatibility_flags: worker.compatibilityFlags,
    workers_dev: worker.workersDev,
    preview_urls: worker.previewUrls,
    assets: {
      directory: tooling.assetsDirectory,
      binding: assetsBinding,
      html_handling: assets.htmlHandling,
      not_found_handling: assets.notFoundHandling,
      run_worker_first: assets.runWorkerFirst,
    },
    ...translateBindings(env, worker.name, skipUntranslated),
    migrations: [{ tag: 'v1', ...migration.classes }],
    observability: worker.observability,
  };
}

interface LocalWranglerConfigOptions {
  /** The Worker config mode, such as `preview`; production when omitted. */
  mode?: string;
  /**
   * Leave out bindings and settings the translation does not cover instead
   * of failing. The OpenNext build reads only the compatibility date and
   * asset routing, so it should not fail on what only a local preview
   * would need.
   */
  skipUntranslated?: boolean;
}

/**
 * Writes the Wrangler config and returns its path with a function that
 * removes it.
 */
export async function writeLocalWranglerConfig(
  root: string,
  options: LocalWranglerConfigOptions = {}
) {
  const path = join(root, `.wrangler.local-${process.pid}.json`);
  await writeFile(
    path,
    `${JSON.stringify(await localWranglerConfig(options), null, 2)}\n`
  );
  return { path, remove: () => unlink(path).catch(() => undefined) };
}

/**
 * Runs a synchronous child command with the Wrangler config in place, then
 * removes the config. Ctrl-C reaches the child, which shares the terminal's
 * process group, so this process ignores SIGINT until the child exits and
 * can still clean up.
 */
export async function runWithLocalWranglerConfig<T>(
  root: string,
  options: LocalWranglerConfigOptions,
  run: (configPath: string) => SpawnSyncReturns<T>
) {
  const config = await writeLocalWranglerConfig(root, options);
  const ignore = () => undefined;
  process.on('SIGINT', ignore);
  try {
    return run(config.path);
  } finally {
    process.off('SIGINT', ignore);
    await config.remove();
  }
}

/**
 * Placeholder local connection strings for every Hyperdrive binding, for
 * tools that read the TypeScript configuration directly. A non-empty value
 * already in the environment is kept.
 */
export async function localHyperdriveEnvironment(mode?: string) {
  const { worker } = await cloudflareConfig({ isPreview: false, mode });
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(worker.env ?? {})) {
    if ((value as Binding).type !== 'hyperdrive') continue;
    const variable = `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${name}`;
    env[variable] = process.env[variable] || LOCAL_HYPERDRIVE_URL;
  }
  return env;
}

/** Arguments that start OpenNext's local Worker preview with a config. */
export function openNextPreviewArgs(configPath: string, args: string[]) {
  return [
    'exec',
    'opennextjs-cloudflare',
    'preview',
    '--config',
    configPath,
    ...args,
  ];
}
