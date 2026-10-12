import type { publicLocation } from './location';

export type PublicStatus = {
  location: ReturnType<typeof publicLocation>;
  weather: {
    temperature: number;
    unit: string;
    code: number;
    isDay: boolean;
    observedAt: string;
  } | null;
};
