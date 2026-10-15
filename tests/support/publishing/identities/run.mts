import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { isMain } from '../runtime.mts';
import { cleanupAcceptanceIdentities } from './cleanup.mts';
import { DEFAULT_JOURNAL } from './config.mts';
import { repairAcceptanceInfrastructure } from './infrastructure.mts';
import { privateWrite } from './journal.mts';
import {
  migrateAcceptanceStorage,
  rollbackAcceptanceStorage,
} from './migration.mts';
import { provisionAcceptanceIdentities } from './provision.mts';

export { cleanupAcceptanceIdentities } from './cleanup.mts';
export { repairAcceptanceInfrastructure } from './infrastructure.mts';
export {
  migrateAcceptanceStorage,
  rollbackAcceptanceStorage,
} from './migration.mts';
export {
  loadOwnedAcceptanceIdentities,
  provisionAcceptanceIdentities,
} from './provision.mts';
export type { AcceptanceIdentities } from './types.mts';

export async function runIdentityCommand() {
  const { values } = parseArgs({
    options: {
      env: { type: 'string' },
      journal: { type: 'string' },
      cleanup: { type: 'boolean', default: false },
      repair: { type: 'boolean', default: false },
      'migrate-storage': { type: 'boolean', default: false },
      'rollback-storage': { type: 'boolean', default: false },
      'verification-cleaned': { type: 'boolean', default: false },
      'configuration-cleared': { type: 'boolean', default: false },
    },
  });
  try {
    assert(
      [
        values.repair,
        values.cleanup,
        values['migrate-storage'],
        values['rollback-storage'],
      ].filter(Boolean).length <= 1,
      'Choose one infrastructure operation.'
    );
    if (values['migrate-storage'] || values['rollback-storage']) {
      const operation = values['migrate-storage']
        ? migrateAcceptanceStorage
        : rollbackAcceptanceStorage;
      console.log(
        JSON.stringify(
          await operation({
            journalPath: values.journal,
            verificationCleaned: values['verification-cleaned'],
          })
        )
      );
      process.exit(0);
    }
    if (values.repair) {
      const repaired = await repairAcceptanceInfrastructure({
        journalPath: values.journal,
      });
      console.log(JSON.stringify(repaired));
      process.exit(0);
    }
    if (values.cleanup) {
      await cleanupAcceptanceIdentities({
        journalPath: values.journal,
        envPath: values.env,
        verificationCleaned: values['verification-cleaned'],
        acceptanceConfigurationCleared: values['configuration-cleared'],
      });
      console.log(
        'Owned acceptance identities and infrastructure are removed. Public PLC history remains.'
      );
      process.exit(0);
    }
    const identities = await provisionAcceptanceIdentities({
      envPath: values.env,
      journalPath: values.journal,
    });
    console.log(
      `Owned accounts are ready: ${identities.publisher.handle} (${identities.publisher.did}) and ${identities.visitor.handle} (${identities.visitor.did}).`
    );
    console.log(`Private recovery journal: ${identities.journalPath}`);
  } catch (error) {
    await privateWrite(
      resolve(
        dirname(resolve(values.journal ?? DEFAULT_JOURNAL)),
        'failure.json'
      ),
      JSON.stringify(
        { timestamp: new Date().toISOString(), error: String(error) },
        null,
        2
      ) + '\n'
    );
    console.error(
      `Identity bootstrap failed. Preserve the private recovery journal at ${resolve(values.journal ?? DEFAULT_JOURNAL)}. Credentials and provider URLs are withheld.`
    );
    process.exitCode = 1;
  }
}

if (isMain(import.meta.url)) await runIdentityCommand();
