import { runImageChecks } from './content/check-images.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runImageChecks();
