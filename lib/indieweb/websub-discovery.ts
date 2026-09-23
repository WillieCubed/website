import { WEBSUB_HUB } from './constants';

export function webSubLinkHeader(selfUrl: string): string {
  return `<${WEBSUB_HUB}>; rel="hub", <${selfUrl}>; rel="self"`;
}
