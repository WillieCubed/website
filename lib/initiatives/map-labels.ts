export interface MapPoint {
  name: string;
  x: number;
  y: number;
  hub?: boolean;
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

function coversPoint(label: MapLabel) {
  return (
    label.x >= label.left &&
    label.x <= label.left + label.width &&
    label.y >= label.top &&
    label.y <= label.top + LABEL_HEIGHT
  );
}

function placeLabel(
  point: MapLabel,
  labels: MapLabel[],
  width: number,
  height: number
) {
  const labelWidth = Math.min(
    width - 16,
    Math.max(44, point.name.length * 7 + 12)
  );
  const sides =
    point.x < width / 2
      ? [point.x - labelWidth - 12, point.x + 12]
      : [point.x + 12, point.x - labelWidth - 12];
  sides.push(
    point.x - labelWidth / 2,
    ...labels.flatMap((label) => [
      label.left - labelWidth - GAP,
      label.left + label.width + GAP,
    ])
  );
  const tops = [
    point.y - LABEL_HEIGHT / 2,
    point.y - LABEL_HEIGHT - 12,
    point.y + 12,
    ...labels.flatMap((label) => [
      label.top - LABEL_HEIGHT - GAP,
      label.top + LABEL_HEIGHT + GAP,
    ]),
  ];
  let best: MapLabel | undefined;
  let distance = Infinity;
  for (const top of tops) {
    for (const side of sides) {
      const candidate = {
        ...point,
        width: labelWidth,
        left: Math.max(8, Math.min(width - labelWidth - 8, side)),
        top: Math.max(4, Math.min(height - LABEL_HEIGHT - 4, top)),
      };
      const candidateDistance = Math.hypot(
        candidate.left + labelWidth / 2 - point.x,
        candidate.top + LABEL_HEIGHT / 2 - point.y
      );
      if (
        candidateDistance < distance &&
        !coversPoint(candidate) &&
        !labels.some((label) => intersects(candidate, label))
      ) {
        best = candidate;
        distance = candidateDistance;
      }
    }
  }
  return (
    best ?? { ...point, width: labelWidth, left: 8, top: height - LABEL_HEIGHT }
  );
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
            group.some(
              (other) => Math.hypot(other.x - point.x, other.y - point.y) < 28
            )
        );
    if (nearby) nearby.push(point);
    else groups.push([point]);
  }
  const labels: MapLabel[] = [];
  for (const group of groups.sort(
    (a, b) => Number(!!b[0].hub) - Number(!!a[0].hub)
  )) {
    const names = points
      .filter((point) => group.some((member) => member.name === point.name))
      .map((point) => point.name);
    const name =
      names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
    const point = {
      name,
      names,
      x: group.reduce((sum, point) => sum + point.x, 0) / group.length,
      y: group.reduce((sum, point) => sum + point.y, 0) / group.length,
      left: 0,
      top: 0,
      width: 0,
    };
    labels.push(placeLabel(point, labels, width, height));
  }
  return labels;
}
