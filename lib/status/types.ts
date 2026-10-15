import type { PublicLocation } from './location';

export interface WeatherObservation {
  temperature: number;
  unit: string;
  code: number;
  isDay: boolean;
  observedAt: string;
}

export interface PublicStatus {
  unavailable?: boolean;
  location: PublicLocation;
  weather: WeatherObservation | null;
}
