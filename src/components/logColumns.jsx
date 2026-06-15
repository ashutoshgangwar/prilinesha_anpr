// src/components/logColumns.jsx
import { EventTypeBadge, RegisteredBadge } from './Badge';
import { EyeIcon, TrashIcon } from './icons';
import { formatDateTime } from '../utils/format';

/**
 * Builds the column definitions shared by the Logs page and the Dashboard's
 * "recent logs" table.
 *
 *  - onView(log):   open the image modal
 *  - onDelete(log): delete the log (with confirm)
 */
export function buildLogColumns({ onView, onDelete }) {
  return [
    { key: 'vehicle_number', header: 'Vehicle Number' },
    {
      key: 'event_type',
      header: 'Event',
      render: (row) => <EventTypeBadge value={row.event_type} />,
    },
    {
      key: 'vehicle_class',
      header: 'Class',
      render: (row) => row.vehicle_class || '—',
    },
    {
      key: 'device_name',
      header: 'Device',
      render: (row) => row.device_name || '—',
    },
    {
      key: 'is_registered',
      header: 'Registered',
      render: (row) => <RegisteredBadge value={row.is_registered} />,
    },
    {
      key: 'intozi_datetime',
      header: 'Date / Time',
      render: (row) => formatDateTime(row.intozi_datetime),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onView(row)}
            className="rounded p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600"
            title="View images"
            aria-label="View images"
          >
            <EyeIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => onDelete(row)}
            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
            title="Delete log"
            aria-label="Delete log"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      ),
    },
  ];
}
