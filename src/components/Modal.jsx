// src/components/Modal.jsx
import { useEffect, useRef } from 'react';
import { CloseIcon } from './icons';

/**
 * Centred dialog with a scrim.
 *
 * Closes on Escape and on a click outside the panel, but never on a click that
 * merely *ends* outside it — a drag that starts inside the form (selecting text
 * in a field) must not be read as "dismiss and lose what I typed".
 *
 * Props:
 *  - open: boolean
 *  - title: string
 *  - onClose: () => void
 *  - footer: optional node pinned below the body
 *  - children: dialog body
 */
export default function Modal({ open, title, onClose, footer, children }) {
  const panelRef = useRef(null);
  const pressedOnScrim = useRef(false);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the dialog from scrolling with it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        pressedOnScrim.current = !panelRef.current?.contains(e.target);
      }}
      onMouseUp={(e) => {
        if (pressedOnScrim.current && !panelRef.current?.contains(e.target)) {
          onClose?.();
        }
        pressedOnScrim.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-8 w-full max-w-lg rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
