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
// connection string; a placeholder is enough when nothing queries it.
const LOCAL_HYPERDRIVE_URL =
  'postgresql://preview:preview@127.0.0.1:5432/preview';

// Secrets have no entry: a local preview reads them from `.dev.vars`.
// The assets binding is placed with its directory below.
const translators: Partial<
  Record<
    string,
    (bindings: LocalBindings, name: string, binding: Binding) => void
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
      localConnectionString:
        process.env[`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${name}`] ??
        LOCAL_HYPERDRIVE_URL,
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
  'durable-object': (bindings, name, { exportName }) => {
    bindings.durable_objects.bindings.push({ name, class_name: exportName });
  },
  images: (bindings, name) => {
    bindings.images = { binding: name };
  },
};

function translateBindings(env: Record<string, unknown>): LocalBindings {
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
    if (!translate) {
      throw new Error(
        `${name} uses the ${binding.type} binding, which the local Wrangler config does not translate yet.`
      );
    }
    translate(bindings, name, binding);
  }
  return bindings;
}

/**
 * Translates the Worker and bundler configuration into the Wrangler JSON
 * that OpenNext's commands still require, so the TypeScript configuration
 * stays the only source of Worker settings.
 *
 * Routes and custom domains are left out: a local preview serves its
 * loopback hostname, and the configured domains redirect to production.
 */
async function localWranglerConfig(mode: string | undefined) {
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
  const sqliteClasses = Object.entries(worker.exports ?? {})
    .filter(([, value]) => (value as Binding).storage === 'sqlite')
    .map(([name]) => name);

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
    assets: { directory: tooling.assetsDirectory, binding: assetsBinding },
    ...translateBindings(env),
    migrations: [{ tag: 'v1', new_sqlite_classes: sqliteClasses }],
    observability: worker.observability,
  };
}

/**
 * Writes the Wrangler config for a Worker config mode and returns its path
 * with a function that removes it.
 */
export async function writeLocalWranglerConfig(root: string, mode?: string) {
  const path = join(root, `.wrangler.local-${process.pid}.json`);
  await writeFile(
    path,
    `${JSON.stringify(await localWranglerConfig(mode), null, 2)}\n`
  );
  // Ctrl-C reaches the child command too; staying alive until it exits lets
  // the caller remove this file instead of leaving it in the checkout.
  const ignore = () => undefined;
  process.on('SIGINT', ignore);
  process.on('SIGTERM', ignore);
  return {
    path,
    remove: async () => {
      process.off('SIGINT', ignore);
      process.off('SIGTERM', ignore);
      await unlink(path).catch(() => undefined);
    },
  };
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
