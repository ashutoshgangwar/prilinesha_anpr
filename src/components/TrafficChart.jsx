// src/components/TrafficChart.jsx
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  formatBucketLabel,
  formatBucketFull,
  labelledIndexes,
  niceScale,
  formatCount,
  GRANULARITY_LABELS,
} from '../utils/analytics';
import { TableIcon, ChartIcon } from './icons';

/**
 * Entries and exits over time, from GET /api/analytics/traffic.
 *
 * The series is already ordered and zero-filled by the API, so nothing here
 * invents or interpolates a point: a quiet day is a real zero and the chart dips
 * through it rather than drawing a straight line over the gap.
 *
 * `unattributed` is drawn only when there is some — it is not a third direction
 * but the detections whose gate has no direction configured, so it stays a
 * recessive gray rather than taking a categorical hue beside entries and exits.
 * It is also why entries + exits need not equal total.
 */

// Categorical slots 1 and 2 of the validated palette (blue / orange): the two
// series are an identity comparison, and this pair clears the colour-vision
// separation gates on a light surface. Unattributed wears the de-emphasis gray.
const SERIES = [
  { key: 'entries', label: 'Entries', color: '#2a78d6' },
  { key: 'exits', label: 'Exits', color: '#eb6834' },
  { key: 'unattributed', label: 'Unattributed', color: '#8a8a86' },
];

const SURFACE = '#ffffff';
const GRID = '#e5e7eb';
const AXIS_TEXT = '#6b7280';

// Past this many buckets the grouped columns are thinner than the gaps between
// them, and the shape of the series is easier to read as a line.
const BAR_LIMIT = 31;

const PAD = { top: 16, right: 16, bottom: 34, left: 46 };
const HEIGHT = 300;

/** The rendered width of the card, so the SVG can be laid out in real pixels. */
function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

function Legend({ series }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {series.map(({ key, label, color }) => (
        <span key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function SeriesTable({ series, granularity, visible }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Bucket</th>
            {visible.map((s) => (
              <th key={s.key} className="px-4 py-2 text-right font-medium">
                {s.label}
              </th>
            ))}
            <th className="px-4 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {series.map((point) => (
            <tr key={point.bucket}>
              <td className="whitespace-nowrap px-4 py-2 text-gray-700">
                {formatBucketFull(point.bucket, granularity)}
              </td>
              {visible.map((s) => (
                <td key={s.key} className="px-4 py-2 text-right tabular-nums text-gray-900">
                  {formatCount(point[s.key])}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-medium tabular-nums text-gray-900">
                {formatCount(point.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TrafficChart({
  series = [],
  granularity = 'day',
  loading = false,
  timezone,
}) {
  const [wrapRef, width] = useElementWidth();
  const [hover, setHover] = useState(null); // index of the hovered bucket
  const [asTable, setAsTable] = useState(false);

  // A series is charted only when it carries something. Unattributed is usually
  // zero, and an always-present flat gray line reads as data that isn't there.
  const visible = useMemo(
    () =>
      SERIES.filter(
        (s) => s.key !== 'unattributed' || series.some((p) => (p[s.key] ?? 0) > 0)
      ),
    [series]
  );

  const max = useMemo(
    () =>
      series.reduce(
        (acc, point) =>
          Math.max(acc, ...visible.map((s) => Number(point[s.key] ?? 0))),
        0
      ),
    [series, visible]
  );

  const { top, ticks } = useMemo(() => niceScale(max), [max]);

  const count = series.length;
  const asBars = count > 0 && count <= BAR_LIMIT;

  // Lines are labelled at their ends, so they need the margin bars do not.
  const padRight = asBars ? PAD.right : 68;
  const plotWidth = Math.max(0, width - PAD.left - padRight);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const y = (value) => PAD.top + plotHeight - (Number(value ?? 0) / top) * plotHeight;
  const band = count > 0 ? plotWidth / count : 0;
  // Bars sit inside their band; points sit on its centre. Both keep the first
  // and last mark clear of the axis.
  const bandCenter = (i) => PAD.left + band * i + band / 2;

  const xLabels = useMemo(
    () => new Set(labelledIndexes(count, Math.max(2, Math.floor(plotWidth / 62)))),
    [count, plotWidth]
  );

  const point = hover != null ? series[hover] : null;

  /**
   * Where each line's end label sits. Converging series would otherwise print
   * their labels on top of one another, so any that are closer than a line's
   * height are pushed apart — and a label that moved gets a leader line back to
   * its own end point, rather than floating beside the wrong series.
   */
  const endLabels = useMemo(() => {
    if (asBars || count === 0 || plotWidth <= 0) return [];

    const last = series[count - 1];
    const placed = visible
      .map((s) => ({ ...s, value: Number(last[s.key] ?? 0), anchor: y(last[s.key]) }))
      .sort((a, b) => a.anchor - b.anchor);

    let previous = -Infinity;
    const spread = placed.map((label) => {
      // 26px: each label is two lines (the series name over its value).
      const yPos = Math.max(label.anchor, previous + 26);
      previous = yPos;
      return { ...label, y: yPos };
    });

    // Series that all end at the same value — two flat lines at zero, say —
    // push the last label past the baseline and into the x-axis labels. The
    // whole stack slides back up by however far it overran.
    const bottom = PAD.top + plotHeight - 6;
    const overflow = Math.max(0, (spread.at(-1)?.y ?? 0) - bottom);

    return spread.map((label) => {
      const yPos = Math.max(PAD.top + 10, label.y - overflow);
      return { ...label, y: yPos, moved: Math.abs(yPos - label.anchor) > 1 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, visible, asBars, count, plotWidth, top, plotHeight]);

  /** The tallest bucket of each series — the one value worth printing on the chart. */
  const peaks = useMemo(() => {
    if (!asBars) return [];
    return visible
      .map((s) => {
        let index = -1;
        let best = 0;
        series.forEach((p, i) => {
          const value = Number(p[s.key] ?? 0);
          if (value > best) {
            best = value;
            index = i;
          }
        });
        return { key: s.key, index, value: best };
      })
      .filter((peak) => peak.index >= 0);
  }, [series, visible, asBars]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Entries and exits</h2>
        {/* <p className="mt-0.5 text-xs text-gray-500">
          {count > 0
            ? `${formatCount(count)} bucket${count === 1 ? '' : 's'} · ${
                GRANULARITY_LABELS[granularity] ?? granularity
              }`
            : 'No buckets in this range'}
          {timezone ? ` · ${timezone}` : ''}
        </p> */}
      </div>

      <div className="flex items-center gap-4">
        <Legend series={visible} />
        {/* <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
          aria-pressed={asTable}
        >
          {asTable ? <ChartIcon className="h-4 w-4" /> : <TableIcon className="h-4 w-4" />}
          {asTable ? 'Chart' : 'Table'}
        </button> */}
      </div>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {header}

      {asTable ? (
        count > 0 ? (
          <SeriesTable series={series} granularity={granularity} visible={visible} />
        ) : (
          <p className="px-5 py-12 text-center text-sm text-gray-500">Nothing to show</p>
        )
      ) : (
        // The frame is held while a refetch is in flight — the previous render
        // simply fades, rather than collapsing into a skeleton and jumping back.
        <div
          ref={wrapRef}
          className={`relative px-2 py-3 transition-opacity ${loading ? 'opacity-40' : ''}`}
        >
          {count === 0 ? (
            <p className="py-16 text-center text-sm text-gray-500">
              No detections in this range
            </p>
          ) : (
            width > 0 && (
              <svg
                width={width}
                height={HEIGHT}
                role="img"
                aria-label="Entries and exits over time"
                onMouseLeave={() => setHover(null)}
              >
                {/* Gridlines and the y scale */}
                {ticks.map((value) => (
                  <g key={value}>
                    <line
                      x1={PAD.left}
                      x2={width - padRight}
                      y1={y(value)}
                      y2={y(value)}
                      stroke={GRID}
                      strokeWidth="1"
                    />
                    <text
                      x={PAD.left - 8}
                      y={y(value) + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill={AXIS_TEXT}
                    >
                      {formatCount(value)}
                    </text>
                  </g>
                ))}

                {/* x labels — thinned to whatever fits, always ending on the last */}
                {series.map((p, i) =>
                  xLabels.has(i) ? (
                    <text
                      key={p.bucket}
                      x={bandCenter(i)}
                      y={HEIGHT - PAD.bottom + 18}
                      textAnchor="middle"
                      fontSize="11"
                      fill={AXIS_TEXT}
                    >
                      {formatBucketLabel(p.bucket, granularity)}
                    </text>
                  ) : null
                )}

                {/* The hovered bucket, lit behind the marks */}
                {hover != null && (
                  <rect
                    x={PAD.left + band * hover}
                    y={PAD.top}
                    width={band}
                    height={plotHeight}
                    fill="#111827"
                    opacity="0.04"
                  />
                )}

                {asBars
                  ? series.map((p, i) => {
                      // Bars share the band, each capped so the band keeps some
                      // air; a 2px gap in the surface colour separates them.
                      const slot = Math.max(2, (band - 8) / visible.length);
                      const barWidth = Math.max(2, Math.min(24, slot - 2));
                      const groupWidth = barWidth * visible.length + 2 * (visible.length - 1);
                      const startX = bandCenter(i) - groupWidth / 2;

                      return (
                        <g key={p.bucket}>
                          {visible.map((s, si) => {
                            const value = Number(p[s.key] ?? 0);
                            if (value <= 0) return null;
                            const barX = startX + si * (barWidth + 2);
                            const barY = y(value);
                            const h = PAD.top + plotHeight - barY;
                            const r = Math.min(4, barWidth / 2, h);

                            // Rounded at the data end, square on the baseline.
                            const d = `M${barX} ${barY + h} L${barX} ${barY + r} Q${barX} ${barY} ${barX + r} ${barY} L${barX + barWidth - r} ${barY} Q${barX + barWidth} ${barY} ${barX + barWidth} ${barY + r} L${barX + barWidth} ${barY + h} Z`;

                            // The series' tallest column carries its value on
                            // the cap — but only where the band is wide enough
                            // to hold the text without it running into its
                            // neighbour. Everything else stays in the tooltip
                            // and the table.
                            const isPeak = peaks.some(
                              (peak) => peak.key === s.key && peak.index === i
                            );

                            return (
                              <g key={s.key}>
                                <path d={d} fill={s.color} />
                                {isPeak && band >= 34 && barY > PAD.top + 12 && (
                                  <text
                                    x={barX + barWidth / 2}
                                    y={barY - 6}
                                    textAnchor="middle"
                                    fontSize="11"
                                    fontWeight="600"
                                    fill="#374151"
                                  >
                                    {formatCount(value)}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </g>
                      );
                    })
                  : visible.map((s) => (
                      <polyline
                        key={s.key}
                        points={series
                          .map((p, i) => `${bandCenter(i)},${y(p[s.key])}`)
                          .join(' ')}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ))}

                {/* End markers and their direct labels, so identity never rests
                    on colour alone. The label is set in ink, not in the series
                    colour — the dot beside it is what carries the identity. */}
                {endLabels.map((label) => (
                  <g key={label.key}>
                    {label.moved && (
                      <line
                        x1={bandCenter(count - 1) + 5}
                        y1={label.anchor}
                        x2={bandCenter(count - 1) + 11}
                        y2={label.y - 4}
                        stroke={GRID}
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={bandCenter(count - 1)}
                      cy={label.anchor}
                      r="4"
                      fill={label.color}
                      stroke={SURFACE}
                      strokeWidth="2"
                    />
                    <text
                      x={bandCenter(count - 1) + 12}
                      y={label.y - 4}
                      fontSize="11"
                      fill={AXIS_TEXT}
                    >
                      {label.label}
                    </text>
                    <text
                      x={bandCenter(count - 1) + 12}
                      y={label.y + 8}
                      fontSize="11"
                      fontWeight="600"
                      fill="#374151"
                    >
                      {formatCount(label.value)}
                    </text>
                  </g>
                ))}

                {/* Markers on the hovered bucket — the reader aims at a date, not
                    at a 2px line. */}
                {!asBars &&
                  hover != null &&
                  visible.map((s) => (
                    <circle
                      key={s.key}
                      cx={bandCenter(hover)}
                      cy={y(series[hover][s.key])}
                      r="4"
                      fill={s.color}
                      stroke={SURFACE}
                      strokeWidth="2"
                    />
                  ))}

                {/* Hit bands: one per bucket, full height, so the pointer only
                    has to be near the right x — never on the mark itself. */}
                {series.map((p, i) => (
                  <rect
                    key={p.bucket}
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotHeight}
                    fill="transparent"
                    tabIndex={0}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                  >
                    <title>
                      {`${formatBucketFull(p.bucket, granularity)} — ${visible
                        .map((s) => `${s.label} ${p[s.key]}`)
                        .join(', ')}`}
                    </title>
                  </rect>
                ))}
              </svg>
            )
          )}

          {point && (
            <div
              className="pointer-events-none absolute z-10 min-w-[10rem] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg"
              style={{
                left: Math.min(Math.max(bandCenter(hover), 90), Math.max(90, width - 90)),
                top: 8,
              }}
            >
              <p className="mb-1.5 font-medium text-gray-500">
                {formatBucketFull(point.bucket, granularity)}
              </p>
              {visible.map((s) => (
                <p key={s.key} className="flex items-center justify-between gap-4 py-0.5">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <span
                      className="h-0.5 w-3 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden="true"
                    />
                    {s.label}
                  </span>
                  <span className="font-semibold tabular-nums text-gray-900">
                    {formatCount(point[s.key])}
                  </span>
                </p>
              ))}
              <p className="mt-1.5 flex items-center justify-between gap-4 border-t border-gray-100 pt-1.5 text-gray-500">
                Total
                <span className="font-semibold tabular-nums text-gray-900">
                  {formatCount(point.total)}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
