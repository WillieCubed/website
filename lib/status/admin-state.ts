import type { City, LocationSnapshot } from './location';

export type AdminState = {
  signedIn?: boolean;
  configured: boolean;
  csrf?: string;
  snapshot?: LocationSnapshot;
  results?: City[];
  query?: string;
  message?: string;
  editing?: boolean;
};
