import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseWeather,
  usableWeather,
  weatherCondition,
} from '@/lib/status/model';

const now = Date.parse('2026-10-11T21:50:00Z');
const response = {
  current: {
    time: '2026-10-11T21:45',
    temperature_2m: 68.9,
    weather_code: 3,
    is_day: 1,
  },
};

test('weather timestamps from the UTC endpoint retain their timezone', () => {
  const weather = parseWeather(response);
  assert.deepEqual(weather, {
    temperature: 69,
    code: 3,
    isDay: true,
    observedAt: '2026-10-11T21:45:00.000Z',
  });
});

test('partial and invalid weather never becomes a plausible temperature', () => {
  for (const value of [
    null,
    {},
    { current: {} },
    { current: { ...response.current, temperature_2m: null } },
    { current: { ...response.current, time: 'invalid' } },
    { current: { ...response.current, weather_code: 500 } },
  ]) {
    assert.equal(parseWeather(value), null);
  }
});

test('weather older than an hour or implausibly in the future is omitted', () => {
  const weather = parseWeather(response)!;
  assert.equal(usableWeather(weather, now), weather);
  assert.equal(usableWeather(weather, now + 60 * 60_000), null);
  assert.equal(usableWeather(weather, now - 20 * 60_000), null);
  assert.equal(usableWeather(null, now), null);
});

test('nighttime conditions do not claim sunshine', () => {
  assert.equal(weatherCondition(0, false).label, 'Clear skies');
  assert.equal(weatherCondition(0, false).icon, 'moon');
  assert.equal(weatherCondition(3, true).label, 'Overcast');
  assert.equal(weatherCondition(61, true).label, 'Rain');
});
