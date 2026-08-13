// src/components/DataTable.jsx
import { TableSkeletonRows } from './Skeletons';

/**
 * Reusable table.
 *
 * Props:
 *  - columns: Array<{ key: string, header: string, render?: (row) => ReactNode, className?: string }>
 *  - data: Array<object>
 *  - rowKey: (row, index) => string | number   (defaults to row.id or index)
 *  - loading: boolean
 *  - failed: the request came back an error — a dead API, or a session that is
 *    no longer good for it. Skeleton rows are drawn rather than the empty
 *    message, because "nothing matched" and "we could not ask" are different
 *    answers and only one of them means the table is really empty. The page
 *    shows the error itself alongside.
 *  - emptyMessage: string
 *  - bare: drop the card chrome (border, rounding, shadow) for callers that
 *    already render the table inside a panel of their own.
 */
export default function DataTable({
  columns,
  data,
  rowKey,
  loading = false,
  failed = false,
  emptyMessage = 'No data found',
  bare = false,
}) {
  const getKey = (row, index) =>
    rowKey ? rowKey(row, index) : row?.id ?? row?._id ?? index;

  return (
    <div
      className={`overflow-x-auto ${
        bare ? '' : 'rounded-lg border border-gray-200 bg-white shadow-sm'
      }`}
    >
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                  col.className || ''
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading || failed ? (
            <TableSkeletonRows columns={columns.length} rows={failed ? 4 : 6} />
          ) : !data || data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={getKey(row, index)}
                className="transition-colors hover:bg-brand-50/50"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-gray-700 whitespace-nowrap ${
                      col.className || ''
                    }`}
                  >
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
