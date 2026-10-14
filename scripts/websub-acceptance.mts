#!/usr/bin/env node
import { runWebSubTests } from '../tests/e2e/publishing/websub/run.mts';
import { isMain } from '../tests/support/publishing/runtime.mts';

if (isMain(import.meta.url)) await runWebSubTests();
