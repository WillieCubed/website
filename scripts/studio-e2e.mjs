import { runStudioTests } from '../tests/support/studio/run.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runStudioTests();
