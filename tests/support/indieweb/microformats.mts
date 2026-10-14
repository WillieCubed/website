import type { mf2 } from 'microformats-parser';

export type MicroformatRoot = ReturnType<typeof mf2>['items'][number];
