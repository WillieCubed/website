import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapLabels } from '@/lib/initiatives/map-labels';
import { geographicView } from '@/lib/initiatives/route-geography';

const cities = [
  ['Dallas', 32.8471, -96.8518],
  ['Plano', 33.0198, -96.6989],
  ['Denton', 33.2148, -97.1331],
  ['New York', 40.7128, -74.006],
  ['Los Angeles', 34.0522, -118.2437],
  ['Chicago', 41.8781, -87.6298],
  ['Dallas–Fort Worth', 32.7767, -96.797],
  ['San Francisco', 37.7749, -122.4194],
  ['Austin', 30.2672, -97.7431],
  ['San Antonio', 29.4241, -98.4936],
  ['Reno', 39.5296, -119.8138],
  ['Long Beach', 33.7701, -118.1937],
] as const;
const places = cities.map(([name, lat, lng]) => ({ name, lat, lng }));
const { project } = geographicView(places, true);
const points = places.map((place) => {
  const [x, y] = project(place.lng, place.lat);
  return { name: place.name, x, y };
});

for (const width of [320, 358, 736, 960]) {
  test(`all tour city labels fit without overlap at ${width}px`, () => {
    const labels = mapLabels(
      points,
      { x: 0, y: 0, width: 800, height: 440 },
      width,
      width < 600 ? 280 : 440
    );
    assert.equal(
      labels.reduce((sum, label) => sum + label.names.length, 0),
      places.length
    );
    for (const label of labels) {
      assert.ok(label.left >= 0 && label.left + label.width <= width);
      assert.ok(label.top >= 0 && label.top + 44 <= 440);
      for (const other of labels) {
        if (label === other) continue;
        assert.ok(
          label.left + label.width <= other.left ||
            other.left + other.width <= label.left ||
            label.top + 44 <= other.top ||
            other.top + 44 <= label.top,
          `${label.name} overlaps ${other.name}`
        );
      }
    }
  });
}

test('zoomed views only label visible stops and keep their actual projected position', () => {
  const view = { x: 300, y: 100, width: 200, height: 110 };
  const labels = mapLabels(
    [
      { name: 'Inside', x: 400, y: 155 },
      { name: 'Outside', x: 700, y: 300 },
    ],
    view,
    400,
    220
  );
  assert.equal(labels.length, 1);
  assert.equal(labels[0].name, 'Inside');
  assert.equal(labels[0].x, 200);
  assert.equal(labels[0].y, 110);
});

test('nearby cities share a named group until zoom gives their labels room', () => {
  const close = [
    { name: 'Dallas', x: 400, y: 220 },
    { name: 'Plano', x: 405, y: 222 },
  ];
  const overview = mapLabels(
    close,
    { x: 0, y: 0, width: 800, height: 440 },
    358,
    280
  );
  assert.equal(overview.length, 1);
  assert.deepEqual(overview[0].names, ['Dallas', 'Plano']);
  const detail = mapLabels(
    close,
    { x: 380, y: 210, width: 40, height: 22 },
    358,
    280
  );
  assert.equal(detail.length, 2);
  assert.deepEqual(
    detail
      .map((label) => label.names)
      .flat()
      .sort(),
    ['Dallas', 'Plano']
  );
});
