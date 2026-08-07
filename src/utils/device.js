// src/utils/device.js

/**
 * Splits a camera's device_name into the gate it watches and the direction it
 * faces.
 *
 * The detection log has no direction field of its own — GET /api/logs dropped
 * event_type — but sites encode it in the device name anyway: "Gate-2 Exit
 * Camera", "entry1", "Main Gate Entry Cam". Reading it back out is what lets the
 * table show "Gate-2 · exit" instead of one long string an operator has to parse
 * by eye.
 *
 * This is presentation only. The exact device_name is what the API filters on,
 * so callers should keep showing it (as a tooltip) and must never send the
 * parsed pieces back as a query.
 */

// A direction word, either standing alone ("Gate-2 Exit Camera") or glued to a
// number ("exit1", "entry_2"). The leading [^a-z] guard is what stops "in"-like
// fragments matching inside real words — "Main Gate" must not read as inbound.
const DIRECTION_PATTERNS = [
  { direction: 'entry', re: /(?:^|[^a-z])(entry|entrance|inbound)(?=\d|[^a-z]|$)/gi },
  { direction: 'exit', re: /(?:^|[^a-z])(exit|outbound)(?=\d|[^a-z]|$)/gi },
];

// Words that say "this is a camera" rather than which gate it is.
const NOISE_RE = /(?:^|[^a-z])(camera|cam|anpr|lpr|device)(?=\d|[^a-z]|$)/gi;

/** Drops the captured word but keeps the boundary character before it. */
const dropWord = (match, word) => match.slice(0, match.length - word.length);

/**
 * @param {string} deviceName Raw device_name from a log row.
 * @returns {{ raw: string, gate: string|null, direction: 'entry'|'exit'|null }}
 */
export function parseDeviceName(deviceName) {
  const raw = String(deviceName ?? '').trim();
  if (!raw) return { raw: '', gate: null, direction: null };

  let direction = null;
  let label = raw;

  for (const { direction: candidate, re } of DIRECTION_PATTERNS) {
    let found = false;
    const stripped = label.replace(re, (match, word) => {
      found = true;
      return dropWord(match, word);
    });
    if (found) {
      direction = candidate;
      label = stripped;
      break;
    }
  }

  label = label
    .replace(NOISE_RE, dropWord)
    .replace(/\s+/g, ' ')
    // Trim separators left behind by the removed words, but keep internal ones
    // so "Gate-2" stays recognisable as the name it came from.
    .replace(/^[\s._-]+|[\s._-]+$/g, '')
    .trim();

  // "exit1" leaves a bare number, which means nothing on its own.
  if (/^\d+$/.test(label)) label = `Gate ${label}`;

  return { raw, gate: label || null, direction };
}
