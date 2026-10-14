export const pause = (ms: number) =>
  new Promise<void>((finish) => setTimeout(finish, ms));
export const PDS_COMMAND = [
  'sh',
  '-c',
  'node /pds/acceptance-smtp.mjs & exec node --enable-source-maps index.ts',
];
