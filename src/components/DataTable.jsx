// src/components/DataTable.jsx
import Spinner from './Spinner';

/**
 * Reusable table.
 *
 * Props:
 *  - columns: Array<{ key: string, header: string, render?: (row) => ReactNode, className?: string }>
 *  - data: Array<object>
 *  - rowKey: (row, index) => string | number   (defaults to row.id or index)
 *  - loading: boolean
 *  - emptyMessage: string
 */
export default function DataTable({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = 'No data found',
}) {
  const getKey = (row, index) =>
    rowKey ? rowKey(row, index) : row?.id ?? row?._id ?? index;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap ${
                  col.className || ''
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10">
                <Spinner />
              </td>
            </tr>
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
              <tr key={getKey(row, index)} className="hover:bg-gray-50">
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
