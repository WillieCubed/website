#!/usr/bin/env node
import { sendChangedWebmentions } from '../lib/indieweb/webmention-publisher';

const result = await sendChangedWebmentions();
if (result.failed) process.exitCode = 1;
