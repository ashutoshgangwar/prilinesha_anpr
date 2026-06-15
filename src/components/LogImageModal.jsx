// src/components/LogImageModal.jsx
import { useEffect, useState } from 'react';
import { fetchLog } from '../api/dataService';
import { getErrorMessage, formatDateTime } from '../utils/format';
import { EventTypeBadge } from './Badge';
import Spinner from './Spinner';
import { CloseIcon } from './icons';

/**
 * Modal that fetches GET /api/logs/:id and shows the event_image (full vehicle)
 * and plate_image (plate crop) side by side. Both are base64 JPEG strings.
 *
 * Props:
 *  - logId: id of the log to fetch (modal is open whenever this is truthy)
 *  - onClose: () => void
 */
export default function LogImageModal({ logId, onClose }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!logId) return;
    let active = true;
    setLoading(true);
    setError('');
    setLog(null);

    fetchLog(logId)
      .then((data) => {
        if (!active) return;
        setLog(data);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, 'Failed to load log details'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [logId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!logId) return null;

  // Accept a ready-to-use data URL (mock snapshots) or raw base64 JPEG.
  const toSrc = (img) => {
    if (!img) return null;
    return String(img).startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Log details
            </h2>
            {log && (
              <p className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
                <span className="font-medium text-gray-700">
                  {log.vehicle_number || 'Unknown plate'}
                </span>
                <EventTypeBadge value={log.event_type} />
                <span>{formatDateTime(log.intozi_datetime)}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {loading ? (
            <Spinner label="Loading images…" />
          ) : error ? (
            <p className="py-8 text-center text-red-600">{error}</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ImagePanel title="Event image" src={toSrc(log?.event_image)} />
              <ImagePanel title="Plate image" src={toSrc(log?.plate_image)} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ImagePanel({ title, src }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-gray-600">{title}</h3>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {src ? (
          <img src={src} alt={title} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-gray-400">No image available</span>
        )}
      </div>
    </div>
  );
}
