export interface MapPoint {
  name: string;
  x: number;
  y: number;
  hub?: boolean;
  inset?: boolean;
}

export interface MapFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapLabel extends MapPoint {
  names: string[];
  left: number;
  top: number;
  width: number;
}

const LABEL_HEIGHT = 44;
const GAP = 4;

function intersects(a: MapLabel, b: MapLabel) {
  return (
    a.left < b.left + b.width + GAP &&
    a.left + a.width + GAP > b.left &&
    a.top < b.top + LABEL_HEIGHT + GAP &&
    a.top + LABEL_HEIGHT + GAP > b.top
  );
}

function coversPoint(label: MapLabel, point: MapPoint) {
  return (
    point.x >= label.left - 6 &&
    point.x <= label.left + label.width + 6 &&
    point.y >= label.top + 5 &&
    point.y <= label.top + 39
  );
}

export function labelEndpoint(label: MapLabel): [number, number] {
  return [
    Math.max(label.left, Math.min(label.left + label.width, label.x)),
    Math.max(label.top + 11, Math.min(label.top + 33, label.y)),
  ];
}

function leaderLength(label: MapLabel) {
  const [x, y] = labelEndpoint(label);
  return Math.hypot(x - label.x, y - label.y);
}

function labelCenterDistance(label: MapLabel) {
  return Math.hypot(
    label.left + label.width / 2 - label.x,
    label.top + 22 - label.y
  );
}

function labelScore(label: MapLabel) {
  return leaderLength(label) + labelCenterDistance(label);
}

function gridPositions(min: number, max: number, offset: number) {
  const start = Math.ceil((min - offset) / 8) * 8 + offset;
  return Array.from(
    { length: Math.max(0, Math.floor((max - start) / 8) + 1) },
    (_, index) => start + index * 8
  );
}

function labelCandidates(
  point: MapLabel,
  markers: MapPoint[],
  width: number,
  height: number,
  fine: boolean
) {
  const labelWidth = Math.min(
    width - 16,
    Math.max(44, point.name.length * 7 + 12)
  );
  const sides = [
    point.x - labelWidth / 2,
    ...[8, 16, 24, 32, 40, 48].flatMap((gap) => [
      point.x - labelWidth - gap,
      point.x + gap,
    ]),
  ];
  const tops = [
    point.y - 44,
    point.y,
    point.y - 22,
    point.y - 52,
    point.y + 8,
    point.y - 60,
    point.y + 16,
  ];
  if (fine) {
    sides.push(
      ...gridPositions(
        Math.max(8, point.x - labelWidth - 48),
        Math.min(width - labelWidth - 8, point.x + 48),
        0
      )
    );
    tops.push(
      ...gridPositions(
        Math.max(4, point.y - 81),
        Math.min(height - LABEL_HEIGHT - 4, point.y + 37),
        4
      )
    );
  }
  const candidates = tops
    .flatMap((top) =>
      sides.map((left) => ({
        ...point,
        width: labelWidth,
        left: Math.max(8, Math.min(width - labelWidth - 8, left)),
        top: Math.max(4, Math.min(height - LABEL_HEIGHT - 4, top)),
      }))
    )
    .filter(
      (label) =>
        leaderLength(label) <= LABEL_HEIGHT + GAP &&
        !coversPoint(label, label) &&
        labelCenterDistance(label) <=
          Math.max(LABEL_HEIGHT, label.width / 2 + 16) &&
        !markers.some(
          (marker) =>
            !label.names.includes(marker.name) && coversPoint(label, marker)
        )
    );
  return [
    ...new Map(
      candidates.map((label) => [`${label.left},${label.top}`, label])
    ).values(),
  ];
}

function partialLayout(options: MapLabel[][]) {
  return options.reduce<MapLabel[]>((labels, candidates) => {
    const candidate = candidates.find(
      (option) => !labels.some((label) => intersects(option, label))
    );
    return candidate ? [...labels, candidate] : labels;
  }, []);
}

function representedNames(labels: MapLabel[]) {
  return labels.reduce((count, label) => count + label.names.length, 0);
}

function preferLayout(candidate: MapLabel[], current: MapLabel[]) {
  const hubs =
    Number(candidate.some((label) => label.hub)) -
    Number(current.some((label) => label.hub));
  return (
    hubs > 0 ||
    (hubs === 0 && representedNames(candidate) > representedNames(current))
  );
}

function arrangeLabels(
  points: MapLabel[],
  markers: MapPoint[],
  width: number,
  height: number,
  fine = false
) {
  const options = points
    .map((point) =>
      labelCandidates(point, markers, width, height, fine).sort(
        (a, b) => labelScore(a) - labelScore(b)
      )
    )
    .sort((a, b) => {
      const hubs = Number(!!b[0]?.hub) - Number(!!a[0]?.hub);
      return hubs !== 0 ? hubs : a.length - b.length;
    });
  let attempts = 0;
  let best = partialLayout(options);
  function place(index: number, labels: MapLabel[]): MapLabel[] | undefined {
    if (preferLayout(labels, best)) best = labels;
    if (index === options.length)
      return labels.length === points.length ? labels : undefined;
    if (++attempts > 512) return undefined;
    for (const candidate of options[index]) {
      if (labels.some((label) => intersects(candidate, label))) continue;
      const result = place(index + 1, [...labels, candidate]);
      if (result) return result;
    }
    return undefined;
  }
  const complete = place(0, []);
  return { labels: complete ?? best, complete: complete !== undefined };
}

function mergeClosest(groups: MapPoint[][]) {
  let closest: [number, number] | undefined;
  let distance = Infinity;
  groups.forEach((group, index) => {
    if (group.some((point) => point.hub)) return;
    groups.slice(index + 1).forEach((other, offset) => {
      if (other.some((point) => point.hub) || group[0].inset !== other[0].inset)
        return;
      const separation = Math.min(
        ...group.flatMap((a) =>
          other.map((b) => Math.hypot(a.x - b.x, a.y - b.y))
        )
      );
      if (separation < distance && separation < 56) {
        closest = [index, index + offset + 1];
        distance = separation;
      }
    });
  });
  if (!closest) return false;
  const [first, second] = closest;
  groups[first].push(...groups[second]);
  groups.splice(second, 1);
  return true;
}

function groupLabel(group: MapPoint[], points: MapPoint[]): MapLabel {
  const names = points
    .filter((point) => group.some((member) => member.name === point.name))
    .map((point) => point.name);
  return {
    name: names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`,
    names,
    hub: group.some((point) => point.hub),
    x: group.reduce((sum, point) => sum + point.x, 0) / group.length,
    y: group.reduce((sum, point) => sum + point.y, 0) / group.length,
    left: 0,
    top: 0,
    width: 0,
  };
}

export function screenMapPoints(
  points: MapPoint[],
  view: MapFrame,
  width: number,
  height: number
) {
  const scale = Math.min(width / view.width, height / view.height);
  const offsetX = (width - view.width * scale) / 2;
  const offsetY = (height - view.height * scale) / 2;
  return points
    .map((point) => ({
      ...point,
      x: (point.x - view.x) * scale + offsetX,
      y: (point.y - view.y) * scale + offsetY,
    }))
    .filter(
      (point) =>
        point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height
    );
}

export function mapLabels(
  points: MapPoint[],
  view: MapFrame,
  width: number,
  height: number
) {
  const visible = screenMapPoints(points, view, width, height);
  const groups: MapPoint[][] = [];
  for (const point of visible.sort((a, b) => a.y - b.y)) {
    const nearby = point.hub
      ? undefined
      : groups.find(
          (group) =>
            !group.some((other) => other.hub) &&
            group[0].inset === point.inset &&
            group.some(
              (other) => Math.hypot(other.x - point.x, other.y - point.y) < 28
            )
        );
    if (nearby) nearby.push(point);
    else groups.push([point]);
  }
  let result;
  let best: MapLabel[] = [];
  do {
    const anchors = groups.map((group) => groupLabel(group, points));
    result = arrangeLabels(anchors, visible, width, height);
    if (preferLayout(result.labels, best)) best = result.labels;
  } while (!result.complete && mergeClosest(groups));
  if (result.complete) return result.labels;
  const fine = arrangeLabels(
    groups.map((group) => groupLabel(group, points)),
    visible,
    width,
    height,
    true
  );
  return preferLayout(fine.labels, best) ? fine.labels : best;
}
