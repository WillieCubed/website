// Atlas is drawn as scattered points that only connect when someone looks
// closely, which is as much as the homepage says about it.
const POINTS: Array<[number, number]> = [
  [14, 70],
  [40, 30],
  [62, 82],
  [92, 46],
  [118, 18],
  [128, 88],
  [156, 56],
  [186, 30],
  [178, 96],
];
const LINKS: Array<[number, number]> = [
  [0, 1],
  [1, 3],
  [2, 3],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 7],
  [6, 8],
];

export function Constellation() {
  return (
    <div className="constellation">
      <svg viewBox="0 0 200 110" aria-hidden="true">
        {LINKS.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={POINTS[a][0]}
            y1={POINTS[a][1]}
            x2={POINTS[b][0]}
            y2={POINTS[b][1]}
          />
        ))}
        {POINTS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" />
        ))}
      </svg>
    </div>
  );
}
