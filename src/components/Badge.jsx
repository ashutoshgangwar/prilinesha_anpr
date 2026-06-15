// src/components/Badge.jsx

const COLORS = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
};

/** Small pill label. `color` is one of: green, red, gray, blue, yellow. */
export default function Badge({ color = 'gray', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        COLORS[color] || COLORS.gray
      }`}
    >
      {children}
    </span>
  );
}

/** Maps an event_type value to a colored badge. */
export function EventTypeBadge({ value }) {
  const v = String(value || '').toLowerCase();
  const color = v === 'entry' ? 'green' : v === 'exit' ? 'red' : 'gray';
  return <Badge color={color}>{value || 'unknown'}</Badge>;
}

/** Maps an is_registered flag to a colored badge. */
export function RegisteredBadge({ value }) {
  const isReg = value === true || value === 'registered' || value === 1;
  return <Badge color={isReg ? 'blue' : 'gray'}>{isReg ? 'registered' : 'unknown'}</Badge>;
}

/** Maps a gate_type value to a colored badge. */
export function GateTypeBadge({ value }) {
  const v = String(value || '').toLowerCase();
  const color = v === 'entry' ? 'green' : v === 'exit' ? 'red' : 'gray';
  return <Badge color={color}>{value || '—'}</Badge>;
}
