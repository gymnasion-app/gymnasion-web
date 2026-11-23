import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { niceTicks } from "../../utils/chartTicks";
import "./LineChart.css";

export interface LineChartPoint {
  /** Data ISO (YYYY-MM-DD). Quando todos os pontos têm data, o eixo X é temporal. */
  date?: string;
  /** Rótulo do eixo X quando não há data (ex.: "S1·2"). */
  label?: string;
  value: number;
  /** Informação extra exibida no tooltip (ex.: "3 sessões"). */
  detail?: string;
}

interface LineChartProps {
  points: LineChartPoint[];
  /** Formata valores do eixo Y, do tooltip, do rótulo final e da média. */
  formatValue: (value: number) => string;
  /** Texto da legenda para a linha (ex.: "Distância (km)"). */
  seriesLabel: string;
  /** Título curto do eixo Y (ex.: "km", "bpm", "min/km"). */
  unitLabel?: string;
  color?: "blue" | "orange";
  /** Domínio fixo do eixo Y (ex.: RPE de 0 a 10). */
  yDomain?: [number, number];
  /** Janela fixa do eixo X em datas ISO (ex.: últimos 30 dias). */
  xDomain?: [string, string];
  showAverage?: boolean;
  averageLabel?: string;
  height?: number;
  compact?: boolean;
  ariaLabel: string;
}

const DAY_MS = 86_400_000;
const toTime = (iso: string) => new Date(iso + "T12:00:00").getTime();
const ddmm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

export default function LineChart({
  points,
  formatValue,
  seriesLabel,
  unitLabel,
  color = "blue",
  yDomain,
  xDomain,
  showAverage = true,
  averageLabel = "Média do período",
  height = 230,
  compact = false,
  ariaLabel,
}: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const margin = { top: compact ? 14 : 24, right: compact ? 14 : 20, bottom: 30, left: compact ? 44 : 58 };
    const plotW = Math.max(40, width - margin.left - margin.right);
    const plotH = Math.max(40, height - margin.top - margin.bottom);
    const values = points.map((p) => p.value).filter(Number.isFinite);
    const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

    const ticks = yDomain
      ? niceTicks(yDomain[0], yDomain[1], compact ? 3 : 6).filter((t) => t >= yDomain[0] && t <= yDomain[1])
      : niceTicks(Math.min(...values), Math.max(...values), compact ? 3 : 5);
    const yMin = yDomain ? yDomain[0] : ticks[0];
    const yMax = yDomain ? yDomain[1] : ticks[ticks.length - 1];
    const y = (v: number) => margin.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

    const temporal = points.length > 0 && points.every((p) => p.date);
    let x: (p: LineChartPoint, i: number) => number;
    let xLabels: { x: number; text: string }[];
    const maxLabels = Math.max(2, Math.floor(plotW / (compact ? 64 : 72)));

    if (temporal) {
      const t0 = toTime(xDomain ? xDomain[0] : points[0].date!);
      const t1 = toTime(xDomain ? xDomain[1] : points[points.length - 1].date!);
      const span = t1 - t0;
      x = (p) => (span <= 0 ? margin.left + plotW / 2 : margin.left + ((toTime(p.date!) - t0) / span) * plotW);
      if (xDomain && span > 0) {
        const n = Math.min(maxLabels, Math.round(span / DAY_MS) + 1);
        xLabels = Array.from({ length: n }, (_, i) => {
          const t = t0 + (span * i) / Math.max(1, n - 1);
          const iso = new Date(t).toISOString().slice(0, 10);
          return { x: margin.left + (plotW * i) / Math.max(1, n - 1), text: ddmm(iso) };
        });
      } else {
        xLabels = pickIndexes(points.length, maxLabels).map((i) => ({ x: x(points[i], i), text: ddmm(points[i].date!) }));
      }
    } else {
      const n = points.length;
      x = (_p, i) => (n <= 1 ? margin.left + plotW / 2 : margin.left + (i / (n - 1)) * plotW);
      xLabels = pickIndexes(n, maxLabels).map((i) => ({ x: x(points[i], i), text: points[i].label ?? String(i + 1) }));
    }

    xLabels = spreadLabels(xLabels, compact ? 50 : 56);
    const coords = points.map((p, i) => ({ x: x(p, i), y: y(p.value) }));
    return { margin, plotW, plotH, ticks, y, coords, xLabels, average };
  }, [points, width, height, compact, yDomain, xDomain]);

  if (points.length === 0) return null;

  const { margin, plotW, plotH, ticks, y, coords, xLabels, average } = geo;
  const baseY = margin.top + plotH;
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${baseY} L${coords[0].x.toFixed(1)},${baseY} Z`
      : "";
  const last = coords[coords.length - 1];
  const lastLabelAnchor = last.x > margin.left + plotW - 40 ? "end" : "middle";

  function nearestIndex(clientX: number, rect: DOMRect): number {
    const px = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < coords.length; i++) {
      if (Math.abs(coords[i].x - px) < Math.abs(coords[best].x - px)) best = i;
    }
    return best;
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    setActive(nearestIndex(e.clientX, e.currentTarget.getBoundingClientRect()));
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      setActive((cur) => Math.min(points.length - 1, Math.max(0, (cur ?? (delta > 0 ? -1 : points.length)) + delta)));
    } else if (e.key === "Escape") {
      setActive(null);
    }
  }

  const activePoint = active !== null ? points[active] : null;
  const activeCoord = active !== null ? coords[active] : null;
  const tooltipLeft = activeCoord ? Math.min(Math.max(activeCoord.x, 70), width - 70) : 0;

  return (
    <div className={`line-chart line-chart--${color}${compact ? " line-chart--compact" : ""}`}>
      <ul className="line-chart__legend" aria-label="Legenda">
        <li>
          <svg className="line-chart__key" width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
            <line x1="1" x2="23" y1="5" y2="5" className="line-chart__key-line" />
            <circle cx="12" cy="5" r="4" className="line-chart__key-dot" />
          </svg>
          {seriesLabel}
        </li>
        {showAverage && average !== null && points.length > 1 && (
          <li>
            <svg className="line-chart__key" width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
              <line x1="1" x2="23" y1="5" y2="5" className="line-chart__key-average" />
            </svg>
            {averageLabel}: <strong>{formatValue(average)}</strong>
          </li>
        )}
      </ul>

      <div className="line-chart__plot" ref={wrapRef}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((cur) => cur ?? points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--line-chart-color)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--line-chart-color)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {unitLabel && !compact && (
            <text className="line-chart__unit" x={margin.left - 8} y={12} textAnchor="end">
              {unitLabel}
            </text>
          )}

          {ticks.map((t) => (
            <g key={t}>
              <line className="line-chart__grid" x1={margin.left} x2={margin.left + plotW} y1={y(t)} y2={y(t)} />
              <text className="line-chart__tick" x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {formatValue(t)}
              </text>
            </g>
          ))}

          <line className="line-chart__axis" x1={margin.left} x2={margin.left} y1={margin.top} y2={baseY} />
          <line className="line-chart__axis" x1={margin.left} x2={margin.left + plotW} y1={baseY} y2={baseY} />

          {xLabels.map((l, i) => (
            <g key={`${l.text}-${i}`}>
              <line className="line-chart__axis" x1={l.x} x2={l.x} y1={baseY} y2={baseY + 4} />
              <text
                className="line-chart__tick"
                x={l.x}
                y={baseY + 18}
                textAnchor={i === 0 && l.x - margin.left < 20 ? "start" : i === xLabels.length - 1 && margin.left + plotW - l.x < 20 ? "end" : "middle"}
              >
                {l.text}
              </text>
            </g>
          ))}

          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

          {showAverage && average !== null && points.length > 1 && (
            <line className="line-chart__average" x1={margin.left} x2={margin.left + plotW} y1={y(average)} y2={y(average)} />
          )}

          {coords.length > 1 && <path className="line-chart__line" d={linePath} />}

          {activeCoord && <line className="line-chart__crosshair" x1={activeCoord.x} x2={activeCoord.x} y1={margin.top} y2={baseY} />}

          {coords.map((c, i) => (
            <circle
              key={i}
              className="line-chart__dot"
              cx={c.x}
              cy={c.y}
              r={i === active ? 6.5 : i === coords.length - 1 ? 5.5 : compact ? 3.5 : 4.5}
            />
          ))}

          {!compact && (
            <text className="line-chart__end-label" x={last.x} y={last.y - 12} textAnchor={lastLabelAnchor}>
              {formatValue(points[points.length - 1].value)}
            </text>
          )}
        </svg>

        {activePoint && activeCoord && (
          <div className="line-chart__tooltip" style={{ left: tooltipLeft, top: Math.max(activeCoord.y - 12, 0) }} role="status">
            <strong>
              {formatValue(activePoint.value)}
              {unitLabel ? <small> {unitLabel}</small> : null}
            </strong>
            <span>{activePoint.date ? ddmm(activePoint.date) + "/" + activePoint.date.slice(0, 4) : activePoint.label}</span>
            {activePoint.detail && <span>{activePoint.detail}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Remove rótulos do eixo X que ficariam colados (datas próximas), preservando sempre o último. */
function spreadLabels(labels: { x: number; text: string }[], minGap: number): { x: number; text: string }[] {
  const kept: { x: number; text: string }[] = [];
  for (const label of labels) {
    if (!kept.length || label.x - kept[kept.length - 1].x >= minGap) kept.push(label);
  }
  const last = labels[labels.length - 1];
  if (last && kept[kept.length - 1] !== last) {
    while (kept.length > 1 && last.x - kept[kept.length - 1].x < minGap) kept.pop();
    kept.push(last);
  }
  return kept;
}

/** Até `max` índices distribuídos, sempre incluindo o primeiro e o último. */
function pickIndexes(n: number, max: number): number[] {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  for (let k = 0; k < max; k++) out.add(Math.round((k * (n - 1)) / (max - 1)));
  return [...out];
}
