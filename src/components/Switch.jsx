// src/components/Switch.jsx

/**
 * On/off toggle.
 *
 * Built on a real <button role="switch"> rather than a styled checkbox, so it
 * is reachable by keyboard, announces its state to a screen reader, and can be
 * disabled while a request is in flight.
 *
 * The state is shown twice on purpose — the knob's position and a word beside
 * it. A bare track reads as decoration to anyone who has not used one before,
 * and colour alone is not a state anyone who is colour-blind can act on.
 *
 * Props:
 *  - checked: boolean
 *  - onChange: (next: boolean) => void
 *  - disabled: boolean
 *  - labels: [offLabel, onLabel] shown beside the track; pass null to hide
 *  - title: tooltip / accessible name
 */
export default function Switch({
  checked,
  onChange,
  disabled = false,
  labels = ['Inactive', 'Active'],
  title,
}) {
  const [offLabel, onLabel] = labels || [];

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        title={title}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
          checked ? 'bg-brand-500' : 'bg-gray-300'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>

      {labels && (
        <span
          className={`text-xs font-medium ${
            checked ? 'text-gray-700' : 'text-gray-400'
          }`}
        >
          {checked ? onLabel : offLabel}
        </span>
      )}
    </span>
  );
}
