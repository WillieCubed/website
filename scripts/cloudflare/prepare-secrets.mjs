import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const output = process.argv[2];
if (!output) {
  console.error(
    'Usage: node scripts/cloudflare/prepare-secrets.mjs <private-json-path>'
  );
  process.exit(2);
}

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const signingKey = {
  ...privateKey.export({ format: 'jwk' }),
  kid: randomBytes(8).toString('hex'),
  alg: 'ES256',
};
const hex = () => randomBytes(32).toString('hex');
const secrets = {
  ATPROTO_OAUTH_JWK: JSON.stringify(signingKey),
  ATPROTO_OAUTH_STORAGE_KEY: randomBytes(32).toString('base64'),
  WEBMENTION_SECRET: hex(),
  WEBMENTION_MODERATION_SECRET: hex(),
  INDIEAUTH_INTROSPECTION_SECRET: hex(),
  INDIEWEB_NOTIFY_SECRET: hex(),
  SEARCH_REINDEX_SECRET: hex(),
};

writeFileSync(output, JSON.stringify(secrets), { flag: 'wx', mode: 0o600 });
console.log(
  `Prepared ${Object.keys(secrets).length} secrets in a private file.`
);
