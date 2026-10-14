import { isMain } from '../tests/support/publishing/runtime.mts';
import { runTokenInventory } from '../tests/support/publishing/token-inventory.mts';

export * from '../tests/support/publishing/token-inventory.mts';

if (isMain(import.meta.url)) await runTokenInventory();
