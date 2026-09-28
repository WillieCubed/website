#!/usr/bin/env node
import {
  pingWebSubHub,
  publishedTopicPaths,
} from '../lib/indieweb/websub-publisher';
import { absoluteUrl } from '../lib/site';

const topics = await publishedTopicPaths();
const result = await pingWebSubHub(topics.map((path) => absoluteUrl(path)));
console.log(`WebSub topics: ${topics.length}; hub accepted: ${result.ok}`);
if (!result.ok) process.exitCode = 1;
