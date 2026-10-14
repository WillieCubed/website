import { captureMusicPrototype } from '../tests/e2e/site/music/capture.mts';
import { isMain } from './shared/command.mts';

if (isMain(import.meta.url)) await captureMusicPrototype();
