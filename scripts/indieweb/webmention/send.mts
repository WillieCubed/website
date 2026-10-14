#!/usr/bin/env node
import { sendChangedWebmentions } from '../../../lib/indieweb/webmention/publisher';
import { isMain } from '../../shared/command.mts';

export async function runWebmentionSend() {
  const result = await sendChangedWebmentions();
  if (result.failed) process.exitCode = 1;
}

if (isMain(import.meta.url)) await runWebmentionSend();
