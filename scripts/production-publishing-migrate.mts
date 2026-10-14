import { runPublishingMigration } from './deploy/publishing-migrate.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runPublishingMigration();
