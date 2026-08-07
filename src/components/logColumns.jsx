// src/components/logColumns.jsx
import { VehicleTypeBadge, DirectionBadge } from './Badge';
import { formatDateTime } from '../utils/format';
import { parseDeviceName } from '../utils/device';

/**
 * Where a row's owner_name came from. The event's own value wins when the camera
 * sent one; otherwise the registered-vehicle registry answers, matched on
 * (group_id, vehicle_number).
 *
 * Not shown as a tag — just the name — but kept as the cell's tooltip, since the
 * two sources can disagree: a registry name is current, while an event name is
 * whatever was true at the moment of the detection.
 */
const SOURCE_LABELS = {
  event: 'Name as sent by the camera with this detection',
  registry: 'Name from the registered-vehicle registry for this project',
};

function OwnerCell({ row }) {
  if (!row.owner_name) return <span className="text-gray-400">—</span>;

  return (
    <span title={SOURCE_LABELS[row.owner_name_source] || undefined}>
      {row.owner_name}
    </span>
  );
}

/**
 * The gate, split out of the camera's device_name: "Gate-2 Exit Camera" reads as
 * Gate-2 with an `exit` badge instead of one long string.
 *
 * The exact device_name stays as the tooltip, because that — not the parsed
 * label — is the value the API's device_name filter matches on.
 */
function GateCell({ row }) {
  const { raw, gate, direction } = parseDeviceName(row.device_name);

  if (!raw) return <span className="text-gray-400">—</span>;

  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap"
      title={raw}
    >
      <span>{gate || '—'}</span>
      <DirectionBadge value={direction} />
    </span>
  );
}

/**
 * Builds the column definitions shared by the Logs page and the Dashboard's
 * "recent logs" table.
 *
 *  - showProject: include the group_id column. Worth a column when the caller
 *    can see more than one project and has not narrowed to a single one; noise
 *    otherwise, since every row would repeat the same value.
 *
 * There are no row actions. GET /api/logs is the whole API — a detection cannot
 * be opened individually or deleted, and the images are not part of the payload.
 */
export function buildLogColumns({ showProject = false } = {}) {
  const columns = [
    {
      key: 'vehicle_number',
      header: 'Vehicle number',
      render: (row) => (
        <span className="font-mono font-medium text-gray-900">
          {row.vehicle_number || '—'}
        </span>
      ),
    },
    {
      key: 'owner_name',
      header: 'Owner',
      render: (row) => <OwnerCell row={row} />,
    },
    {
      key: 'vehicle_model',
      header: 'Model',
      render: (row) => row.vehicle_model || <span className="text-gray-400">—</span>,
    },
    {
      key: 'vehicle_type',
      header: 'Type',
      // Read from the event — the status as judged when the vehicle was seen —
      // so a registration expiring today never rewrites last week's rows.
      render: (row) => <VehicleTypeBadge value={row.vehicle_type} />,
    },
    {
      key: 'device_name',
      header: 'Gate',
      render: (row) => <GateCell row={row} />,
    },
    {
      key: 'detected_at',
      header: 'Detected at',
      // detected_at is when the camera saw the vehicle; received_at is when the
      // event reached us. The first is the one an operator is looking for, so
      // the second rides along as a tooltip rather than its own column.
      render: (row) => (
        <span
          className="whitespace-nowrap"
          title={
            row.received_at
              ? `Received ${formatDateTime(row.received_at)}`
              : undefined
          }
        >
          {formatDateTime(row.detected_at)}
        </span>
      ),
    },
  ];

  if (showProject) {
    // Leads the row rather than sitting inside it, so the six main columns keep
    // their order whether or not the project is shown.
    columns.unshift({
      key: 'group_id',
      header: 'Project',
      render: (row) => (
        <span className="font-mono text-xs text-gray-600">{row.group_id || '—'}</span>
      ),
    });
  }

  return columns;
}
