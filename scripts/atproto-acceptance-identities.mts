import { runIdentityCommand } from '../tests/support/publishing/identities/run.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

export {
  cleanupAcceptanceIdentities,
  loadOwnedAcceptanceIdentities,
  migrateAcceptanceStorage,
  provisionAcceptanceIdentities,
  repairAcceptanceInfrastructure,
  rollbackAcceptanceStorage,
} from '../tests/support/publishing/identities/run.mts';

if (isMain(import.meta.url)) await runIdentityCommand();

export type { AcceptanceIdentities } from '../tests/support/publishing/identities/run.mts';
