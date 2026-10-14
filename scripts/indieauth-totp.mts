#!/usr/bin/env node
import { runTotpSetup } from './indieweb/indieauth/totp.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await runTotpSetup();
