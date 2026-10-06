// src/components/Badge.jsx
import { getIntoziSyncMeta } from '../utils/format';
import { CheckIcon, ClockIcon, AlertIcon, MinusIcon } from './icons';

const COLORS = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  amber: 'bg-amber-100 text-amber-800',
  slate: 'bg-slate-100 text-slate-700',
};

/** Small pill label. `color` is one of: green, red, gray, blue, yellow, amber, slate. */
export default function Badge({ color = 'gray', children, icon: Icon = null, title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        COLORS[color] || COLORS.gray
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

/**
 * Direction a detection was facing, read out of the camera's device_name
 * (see utils/device.js). Green in, red out — the same reading as the gate
 * signage itself.
 */
export function DirectionBadge({ value }) {
  const v = String(value || '').toLowerCase();
  if (v === 'entry') return <Badge color="green">entry</Badge>;
  if (v === 'exit') return <Badge color="red">exit</Badge>;
  return null;
}

/**
 * Maps a log's vehicle_type ("registered" | "unregistered") to a badge.
 * Unregistered is the notable case at a gate, so it gets the warmer colour.
 */
export function VehicleTypeBadge({ value }) {
  const v = String(value || '').toLowerCase();
  if (v === 'registered') return <Badge color="blue">registered</Badge>;
  if (v === 'unregistered') return <Badge color="yellow">unregistered</Badge>;
  return <Badge color="gray">—</Badge>;
}

/** Maps a gate_type value to a colored badge. */
export function GateTypeBadge({ value }) {
  const v = String(value || '').toLowerCase();
  const color = v === 'entry' ? 'green' : v === 'exit' ? 'red' : 'gray';
  return <Badge color={color}>{value || '—'}</Badge>;
}

const INTOZI_ICONS = {
  check: CheckIcon,
  clock: ClockIcon,
  alert: AlertIcon,
  minus: MinusIcon,
};

/**
 * Where a vehicle or visitor row stands on Intozi's watchlist. Read-only — the
 * backend syncs automatically, so this only reports status, it never sets it.
 * Colour, label, icon and tooltip all come from getIntoziSyncMeta, which
 * defaults a missing/unknown status to "pending". Pass the whole row (it reads
 * row.intozi_sync). Shared by the registry/visitor tables and their detail view.
 */
export function IntoziSyncBadge({ row }) {
  const meta = getIntoziSyncMeta(row);
  return (
    <Badge color={meta.color} icon={INTOZI_ICONS[meta.icon] || null} title={meta.title}>
      {meta.label}
    </Badge>
  );
}
