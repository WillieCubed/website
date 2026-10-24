'use client';

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  type MapFrame,
  type MapLabel,
  type MapPoint,
  mapLabels,
  screenMapPoints,
} from '@/lib/initiatives/map-labels';

interface RouteMapCanvasProps {
  title: string;
  points: MapPoint[];
  children: ReactNode;
  compact?: boolean;
}

const WORLD: MapFrame = { x: 0, y: 0, width: 800, height: 440 };

const PAN_STEPS = new Map<string, [number, number]>([
  ['ArrowLeft', [-1, 0]],
  ['ArrowRight', [1, 0]],
  ['ArrowUp', [0, -1]],
  ['ArrowDown', [0, 1]],
]);

function zoomView(view: MapFrame, multiplier: number, center?: MapPoint) {
  const width = Math.max(4, Math.min(WORLD.width, view.width * multiplier));
  const height = (width * WORLD.height) / WORLD.width;
  return {
    x: (center?.x ?? view.x + view.width / 2) - width / 2,
    y: (center?.y ?? view.y + view.height / 2) - height / 2,
    width,
    height,
  };
}

function groupView(points: MapPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(
    4,
    (Math.max(...xs) - Math.min(...xs)) * 1.8,
    ((Math.max(...ys) - Math.min(...ys)) * 1.8 * WORLD.width) / WORLD.height
  );
  return zoomView(WORLD, width / WORLD.width, {
    name: points[0].name,
    x: (Math.max(...xs) + Math.min(...xs)) / 2,
    y: (Math.max(...ys) + Math.min(...ys)) / 2,
  });
}

function cityView(point: MapPoint, points: MapPoint[]) {
  const neighbors = points.filter((other) => other.name !== point.name);
  const nearest = Math.min(
    ...neighbors.map((other) =>
      Math.hypot(other.x - point.x, other.y - point.y)
    )
  );
  // Separate neighboring markers when a reader asks for one specific city.
  return zoomView(
    WORLD,
    Math.min(160, Math.max(4, nearest * 6)) / WORLD.width,
    point
  );
}

interface MapControlsProps {
  title: string;
  points: MapPoint[];
  selected: string[];
  onZoom: (multiplier: number) => void;
  onReset: () => void;
  onSelect: (point: MapPoint) => void;
}

function MapControls({
  title,
  points,
  selected,
  onZoom,
  onReset,
  onSelect,
}: MapControlsProps) {
  return (
    <div
      className="route-map__controls"
      role="group"
      aria-label={`${title} controls`}
    >
      <button
        type="button"
        className="site-control"
        aria-label="Zoom in"
        onClick={() => onZoom(0.5)}
      >
        +
      </button>
      <button
        type="button"
        className="site-control"
        aria-label="Zoom out"
        onClick={() => onZoom(2)}
      >
        −
      </button>
      <button type="button" className="site-control" onClick={onReset}>
        Show all
      </button>
      <label className="route-map__stop-picker">
        <span className="sr-only">Find a city</span>
        <select
          aria-label="Find a city"
          value={selected.length === 1 ? selected[0] : ''}
          onChange={(event) => {
            const point = points.find(
              (point) => point.name === event.target.value
            );
            if (point) onSelect(point);
          }}
        >
          <option value="" disabled>
            Find a city
          </option>
          {points.map((point) => (
            <option key={point.name} value={point.name}>
              {point.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function useCanvasSize(
  container: RefObject<HTMLDivElement | null>,
  compact: boolean
) {
  const [size, setSize] = useState({
    width: compact ? 144 : 800,
    height: compact ? 160 : 440,
    ready: false,
  });
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === 0 || entry.contentRect.height === 0)
        return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
        ready: true,
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [container]);
  return size;
}

interface CityLabelProps {
  label: MapLabel;
  active: boolean;
  ready: boolean;
  compact: boolean;
  onSelect: (names: string[]) => void;
}

function CityLabel({
  label,
  active,
  ready,
  compact,
  onSelect,
}: CityLabelProps) {
  const style = { left: label.left, top: label.top, width: label.width };
  if (compact)
    return (
      <span className="route-map__city" style={style}>
        {label.name}
      </span>
    );
  return (
    <button
      type="button"
      disabled={!ready}
      className="route-map__city site-control"
      aria-label={label.names.join(', ')}
      aria-pressed={active}
      style={style}
      onClick={() => onSelect(label.names)}
    >
      {label.name}
    </button>
  );
}

export default function RouteMapCanvas({
  title,
  points,
  children,
  compact = false,
}: RouteMapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; view: MapFrame } | null>(null);
  const size = useCanvasSize(container, compact);
  const ready = size.ready;
  const [view, setView] = useState(WORLD);
  const [selected, setSelected] = useState<string[]>([]);
  const labels = mapLabels(points, view, size.width, size.height);
  const markers = screenMapPoints(points, view, size.width, size.height);
  function reset() {
    setView(WORLD);
    setSelected([]);
  }
  function select(point: MapPoint) {
    setSelected([point.name]);
    setView(cityView(point, points));
  }
  function selectGroup(names: string[]) {
    setSelected(names);
    setView(groupView(points.filter((point) => names.includes(point.name))));
    container.current
      ?.querySelector<SVGSVGElement>('svg')
      ?.focus({ preventScroll: true });
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const scale = Math.min(size.width / view.width, size.height / view.height);
    setView({
      ...drag.current.view,
      x: drag.current.view.x - (event.clientX - drag.current.x) / scale,
      y: drag.current.view.y - (event.clientY - drag.current.y) / scale,
    });
  }
  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    const delta = PAN_STEPS.get(event.key);
    if (!delta) return;
    event.preventDefault();
    setView({
      ...view,
      x: view.x + (delta[0] * view.width) / 5,
      y: view.y + (delta[1] * view.height) / 5,
    });
  }
  return (
    <div
      className="route-map__interactive"
      data-ready={ready}
      data-compact={compact}
    >
      <MapControls
        title={title}
        points={points}
        selected={selected}
        onZoom={(multiplier) => setView(zoomView(view, multiplier))}
        onReset={reset}
        onSelect={select}
      />
      <div className="route-map__scroll">
        <div ref={container} className="route-map__canvas">
          <svg
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            role="img"
            aria-label={
              compact ? title : `${title}: drag to move; use arrow keys to pan`
            }
            tabIndex={compact ? undefined : 0}
            onKeyDown={compact ? undefined : keyboard}
            onPointerDown={(event) => {
              if (compact || !event.isPrimary) return;
              drag.current = { x: event.clientX, y: event.clientY, view };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={move}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <svg x="0" y="0" width="800" height="440" overflow="hidden">
              {children}
            </svg>
          </svg>
          <svg
            viewBox={`0 0 ${size.width} ${size.height}`}
            className="route-map__leaders"
            aria-hidden="true"
          >
            {ready &&
              markers.map((point) => (
                <circle key={point.name} cx={point.x} cy={point.y} r="5" />
              ))}
            {labels.map((label) => (
              <path
                key={label.name}
                d={`M${label.x} ${label.y}L${label.left + label.width / 2} ${label.top + 22}`}
              />
            ))}
          </svg>
          {labels.map((label) => (
            <CityLabel
              key={label.name}
              label={label}
              active={label.names.some((name) => selected.includes(name))}
              ready={ready}
              compact={compact}
              onSelect={selectGroup}
            />
          ))}
        </div>
      </div>
      {selected.length > 0 && (
        <p className="route-map__selection" aria-live="polite">
          {selected.join(' · ')}
        </p>
      )}
      <div className="route-map__interaction-hint">
        Select a city or group to zoom. Drag to move the map.
      </div>
    </div>
  );
}
