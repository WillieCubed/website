import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';

import { sealJson, unsealJson } from '../../lib/crypto/sealed-json';
import { isMain } from '../shared/command.mts';

export async function migrateMusicSharedKey() {
  const [previousEnvPath, newKeyPath] = process.argv.slice(2);
  if (!previousEnvPath || !newKeyPath)
    throw new Error(
      'Pass the previous private env file and new Music key file.'
    );

  const { oldKey, databaseURL, newKey } = await migrationKeys(
    previousEnvPath,
    newKeyPath
  );

  const pool = new Pool({ connectionString: databaseURL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pending = await client.query(
      'SELECT 1 FROM music_oauth_states LIMIT 1'
    );
    if (pending.rowCount)
      throw new Error('Finish or clear pending Spotify authorizations first.');
    const rows = await client.query(
      'SELECT encrypted_grant FROM music_connections WHERE singleton=true FOR UPDATE'
    );
    if (rows.rowCount !== 1)
      throw new Error('Expected exactly one saved Spotify connection.');
    const grant = unsealJson<{
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      authorizedAt: number;
    }>(rows.rows[0].encrypted_grant, oldKey);
    assert.equal(typeof grant.accessToken, 'string');
    assert.equal(typeof grant.refreshToken, 'string');
    assert.equal(typeof grant.expiresAt, 'number');
    assert.equal(typeof grant.authorizedAt, 'number');

    const ciphertext = sealJson(grant, newKey);
    assert.deepEqual(unsealJson(ciphertext, newKey), grant);
    await client.query(
      'UPDATE music_connections SET encrypted_grant=$1,updated_at=now() WHERE singleton=true',
      [ciphertext]
    );
    const saved = await client.query(
      'SELECT encrypted_grant FROM music_connections WHERE singleton=true'
    );
    assert.deepEqual(unsealJson(saved.rows[0].encrypted_grant, newKey), grant);
    await client.query('COMMIT');
    console.log('One Spotify grant re-encrypted and verified.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function migrationKeys(previousEnvPath: string, newKeyPath: string) {
  const previous = parseEnv(await readFile(previousEnvPath, 'utf8'));
  const oldKey = previous.STUDIO_TOKEN_ENCRYPTION_KEY;
  const databaseURL = previous.STUDIO_DATABASE_URL;
  const newKey = (await readFile(newKeyPath, 'utf8')).trim();
  if (!oldKey || !databaseURL || !newKey)
    throw new Error('The database and both encryption keys are required.');
  if (Buffer.from(oldKey, 'base64').length !== 32)
    throw new Error('The previous encryption key is invalid.');
  if (Buffer.from(newKey, 'base64').length !== 32 || oldKey === newKey)
    throw new Error('The new Music key must be a different 32-byte key.');

  return { oldKey, databaseURL, newKey };
}

if (isMain(import.meta.url)) await migrateMusicSharedKey();
