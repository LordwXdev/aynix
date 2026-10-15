import { useEffect, useMemo, useRef, useState } from "react";

export interface Point {
  label: string; // shown on the x axis and in the tooltip
  value: number;
}

const TICKS = 4;

// clean round steps for the y axis: 0, 10, 20, 30, 40 or 0, 10K, 20K...
// small numbers never get half steps (you can't have 2.5 orders)
const niceStep = (max: number) => {
  if (max <= 0) return 1;
  const rough = max / TICKS;
  const base = Math.pow(10, Math.floor(Math.log10(rough)));
  const steps = base >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  for (const m of steps) {
    if (m * base >= rough) return Math.max(1, m * base);
  }
  return 10 * base;
};

/**
 * One series of columns (for example: orders per day).
 * Thin bars with rounded tops, a light grid, hover tooltip,
 * and a "Table" switch so the numbers are readable without the chart.
 */
export const ColumnChart = ({
  title,
  points,
  format,
  axisFormat,
}: {
  title: string;
  points: Point[];
  format: (n: number) => string;
  axisFormat: (n: number) => string;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // draw at the real size of the card, so text stays readable on a phone
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [asTable]);

  const height = 200;
  const pad = { top: 8, right: 4, bottom: 22, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const step = useMemo(() => niceStep(Math.max(0, ...points.map((p) => p.value))), [points]);
  const max = step * TICKS;
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => i * step);
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.min(24, Math.max(3, band - 2)); // capped, leaves air between bars
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;

  // label every few days so the axis never gets crowded
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(plotW / 80)));
  const total = points.reduce((sum, p) => sum + p.value, 0);

  const tip = hover !== null ? points[hover] : null;
  // keep the tooltip inside the card near the edges
  const tipX = hover !== null ? Math.min(88, Math.max(12, ((pad.left + band * hover + band / 2) / width) * 100)) : 0;
  const tipY = tip ? (y(tip.value) / height) * 100 : 0;

  return (
    <div className="card">
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          <div className="small muted">Last 30 days · total {format(total)}</div>
        </div>
        <div className="seg" role="group" aria-label="View">
          <button className={asTable ? "" : "on"} onClick={() => setAsTable(false)}>
            Chart
          </button>
          <button className={asTable ? "on" : ""} onClick={() => setAsTable(true)}>
            Table
          </button>
        </div>
      </div>

      {asTable ? (
        <div className="table-wrap" style={{ maxHeight: 220, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th className="num">{title}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td className="num">{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart" ref={box} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={`${title}, last 30 days`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid-line" x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
                <text className="axis-text" x={pad.left - 6} y={y(t) + 4} textAnchor="end">
                  {axisFormat(t)}
                </text>
              </g>
            ))}

            {points.map((p, i) => {
              const x = pad.left + band * i + (band - barW) / 2;
              const h = Math.max(0, (p.value / max) * plotH);
              const r = Math.min(4, h, barW / 2);
              const top = pad.top + plotH - h;
              // rounded at the top, square at the baseline
              const path =
                h <= 0
                  ? ""
                  : `M${x},${pad.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + plotH} Z`;
              return (
                <g key={p.label}>
                  {path && (
                    <path className={`bar${hover !== null && hover !== i ? " dim" : ""}`} d={path} />
                  )}
                  {i % labelEvery === 0 && (
                    <text className="axis-text" x={x + barW / 2} y={height - 6} textAnchor="middle">
                      {p.label}
                    </text>
                  )}
                  {/* the hover area is the whole column, much bigger than the bar */}
                  <rect
                    className="hit"
                    x={pad.left + band * i}
                    y={pad.top}
                    width={band}
                    height={plotH}
                    onMouseEnter={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>
          {tip && (
            <div className="chart-tip" style={{ left: `${tipX}%`, top: `${tipY}%` }}>
              <span className="muted">{tip.label}</span>
              <strong>{format(tip.value)}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
