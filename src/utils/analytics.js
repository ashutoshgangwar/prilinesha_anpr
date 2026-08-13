// src/utils/analytics.js
//
// Helpers for the reporting screens. The rule that shapes this file: a bucket
// key is read as TEXT, never re-parsed into a Date.
//
// The server builds every bucket in the REPORT timezone (Asia/Kolkata by
// default), which is not necessarily the browser's. Turning "2026-08-13" into a
// Date here and formatting it back would re-express it in the laptop's zone, and
// an operator in another country would see the chart's labels slide by a day
// against the numbers. The key already says what it means; the parts are simply
// pulled out of it.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Server bucket key formats — see BUCKET_FORMATS in the API's timezone util. */
const PATTERNS = {
  hour: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00$/,
  day: /^(\d{4})-(\d{2})-(\d{2})$/,
  week: /^(\d{4})-W(\d{2})$/, // ISO week-numbering year + ISO week
  month: /^(\d{4})-(\d{2})$/,
};

const monthName = (mm) => MONTHS[Number(mm) - 1] ?? mm;

/**
 * The short form that rides the x-axis: as few characters as still identify the
 * bucket, since these sit under one another across the width of the chart.
 */
export const formatBucketLabel = (bucket, granularity) => {
  const raw = String(bucket ?? '');

  if (granularity === 'hour') {
    const m = raw.match(PATTERNS.hour);
    return m ? `${m[4]}:00` : raw;
  }
  if (granularity === 'week') {
    const m = raw.match(PATTERNS.week);
    return m ? `W${Number(m[2])}` : raw;
  }
  if (granularity === 'month') {
    const m = raw.match(PATTERNS.month);
    return m ? monthName(m[2]) : raw;
  }
  const m = raw.match(PATTERNS.day);
  return m ? `${Number(m[3])} ${monthName(m[2])}` : raw;
};

/**
 * The unabbreviated form, for the tooltip and the table view — where there is
 * room for the year, and where an hour bucket must still say which day it is on.
 */
export const formatBucketFull = (bucket, granularity) => {
  const raw = String(bucket ?? '');

  if (granularity === 'hour') {
    const m = raw.match(PATTERNS.hour);
    return m
      ? `${Number(m[3])} ${monthName(m[2])} ${m[1]}, ${m[4]}:00`
      : raw;
  }
  if (granularity === 'week') {
    const m = raw.match(PATTERNS.week);
    return m ? `Week ${Number(m[2])}, ${m[1]}` : raw;
  }
  if (granularity === 'month') {
    const m = raw.match(PATTERNS.month);
    return m ? `${monthName(m[2])} ${m[1]}` : raw;
  }
  const m = raw.match(PATTERNS.day);
  return m ? `${Number(m[3])} ${monthName(m[2])} ${m[1]}` : raw;
};

export const GRANULARITY_LABELS = {
  hour: 'Hourly',
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
};

/** Coarse → fine, which is also the order a too-wide window is widened along. */
const GRANULARITY_ORDER = ['hour', 'day', 'week', 'month'];

const APPROX_DAYS_PER_BUCKET = { hour: 1 / 24, day: 1, week: 7, month: 30 };

const MS_PER_DAY = 86_400_000;

/**
 * Roughly how many points a window would produce. Approximate on purpose — the
 * server's count is authoritative, and this exists only to pick a granularity
 * that will not be rejected, not to predict the exact number.
 *
 * Returns null when either end is missing, since an open window is the server's
 * default span rather than something to measure.
 */
export const estimateBuckets = (from, to, granularity) => {
  if (!from || !to) return null;
  const start = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;

  const days = (end - start) / MS_PER_DAY + 1;
  return Math.ceil(days / (APPROX_DAYS_PER_BUCKET[granularity] ?? 1));
};

/** Whole local days from `from` to `to`, inclusive. Null if either is missing. */
export const spanInDays = (from, to) => estimateBuckets(from, to, 'day');

/**
 * A bare YYYY-MM-DD moved by whole days. Done in UTC on purpose: these are
 * calendar dates the API reads as local days in the report timezone, not
 * instants, so a DST-aware shift in the browser's zone would be the wrong
 * arithmetic on the right-looking value.
 */
export const shiftDate = (date, days) => {
  if (!date) return date;
  const at = Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(at)) return date;
  return new Date(at + days * MS_PER_DAY).toISOString().slice(0, 10);
};

/**
 * The finest granularity that keeps the window inside the API's bucket ceiling.
 *
 * Picking a date range should not hand back a 400 the user then has to decode
 * into "choose a coarser granularity" — so the range picker coarsens first and
 * says it did. The server still enforces the real limit.
 */
export const fitGranularity = (from, to, preferred, maxBuckets = 750) => {
  const startAt = Math.max(0, GRANULARITY_ORDER.indexOf(preferred));

  for (let i = startAt; i < GRANULARITY_ORDER.length; i += 1) {
    const candidate = GRANULARITY_ORDER[i];
    const buckets = estimateBuckets(from, to, candidate);
    if (buckets == null || buckets <= maxBuckets) return candidate;
  }
  return 'month';
};

/**
 * Which x-axis labels to draw. Every bucket gets a tick once they fit; past that
 * only every nth is labelled, always including the last one so the axis ends on
 * the most recent bucket rather than wherever the stride happened to land.
 */
export const labelledIndexes = (count, maxLabels) => {
  if (count <= 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);

  const stride = Math.ceil(count / maxLabels);
  const indexes = [];
  for (let i = count - 1; i >= 0; i -= stride) indexes.unshift(i);
  return indexes;
};

/**
 * A y-axis top that lands on a round number, with the tick values under it.
 * A max of 0 (a window with no detections) still draws a 0–1 axis, so the chart
 * keeps its shape instead of collapsing onto the baseline.
 */
export const niceScale = (max, tickCount = 4) => {
  const target = Math.max(1, max);
  const rawStep = target / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  // Detections are whole vehicles: a "1.5" gridline on a chart whose tallest
  // column is 2 is a tick nothing can ever land on. Below a step of 1 the axis
  // simply counts.
  const step = Math.max(
    1,
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ??
      10 * magnitude
  );

  // One step of headroom when the tallest mark would otherwise touch the top of
  // the plot, so the peak's own label has somewhere to sit.
  let top = Math.ceil(target / step) * step;
  if (target / top > 0.92) top += step;
  const ticks = [];
  for (let value = 0; value <= top + step / 2; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return { top, ticks };
};

/** 1234 → "1,234". Counts are always whole numbers here. */
export const formatCount = (value) => Number(value ?? 0).toLocaleString();

/** Where a gate's direction came from, said in words rather than in enum. */
export const DIRECTION_SOURCE_LABELS = {
  configured: 'Configured',
  inferred_from_name: 'Inferred from name',
  unknown: 'Not set',
};
