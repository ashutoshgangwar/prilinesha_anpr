// src/components/Skeletons.jsx
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

/**
 * Loading placeholders, from `react-loading-skeleton`.
 *
 * They stand in for two different situations, on purpose:
 *
 *   loading   — the request is in flight.
 *   failed    — the request came back wrong: the session is not usable, or the
 *               API is down or unreachable.
 *
 * Both draw the same grey shapes because in both cases the honest answer is
 * "this is not here yet". What must never happen is the third thing: a screen
 * full of invented rows. An unreachable backend used to fall back to mock data,
 * which looked exactly like real data and could be acted on — see DEMO in
 * config.js, which is now off.
 *
 * A failed screen always carries a visible error message next to the skeleton,
 * so it is never mistaken for a slow one that will eventually resolve.
 */

const BASE = '#e9eaec';
const HIGHLIGHT = '#f4f5f6';

/** Wraps the app so every Skeleton below inherits the same colours. */
export function SkeletonProvider({ children }) {
  return (
    <SkeletonTheme baseColor={BASE} highlightColor={HIGHLIGHT} borderRadius="0.375rem">
      {children}
    </SkeletonTheme>
  );
}

/** Rows of cells inside an existing table, so the header and layout hold still. */
export function TableSkeletonRows({ columns, rows = 6 }) {
  return Array.from({ length: rows }, (_, rowIndex) => (
    <tr key={rowIndex}>
      {Array.from({ length: columns }, (_, colIndex) => (
        <td key={colIndex} className="px-4 py-3">
          {/* Varied widths, so it reads as text rather than as a grid of bars. */}
          <Skeleton
            height={14}
            width={colIndex === 0 ? '70%' : `${55 + ((rowIndex + colIndex) % 4) * 10}%`}
          />
        </td>
      ))}
    </tr>
  ));
}

/** The number tiles on the dashboard. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Skeleton height={14} width={110} />
        <Skeleton height={36} width={36} borderRadius="0.5rem" />
      </div>
      <div className="mt-3">
        <Skeleton height={30} width={80} />
      </div>
      <div className="mt-1">
        <Skeleton height={10} width={140} />
      </div>
    </div>
  );
}

/** The traffic chart's plot area. */
export function ChartSkeleton({ height = 300 }) {
  return (
    <div className="px-5 py-4">
      <Skeleton height={height} />
    </div>
  );
}

/**
 * The row of filter chips above a table.
 *
 * Each chip carries a count from the API, so there is nothing honest to draw
 * before that answer arrives — and nothing at all to draw if it never does.
 */
export function ChipsSkeleton({ count = 4 }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={34} width={110} borderRadius="9999px" />
      ))}
    </div>
  );
}

/** A block of lines, for panels that are neither a table nor a tile. */
export function TextSkeleton({ lines = 3, width = '100%' }) {
  return <Skeleton count={lines} height={14} width={width} />;
}

export default Skeleton;
