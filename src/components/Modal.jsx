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
    // Scrolling lives on this outer element, with the centring done by an inner
    // wrapper that is at least full height. Centring directly on a scroll
    // container is the classic trap: once the panel is taller than the viewport,
    // `items-center` pushes its top edge above the scrollable area, where it can
    // never be reached — which is exactly what a 50-camera form does.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50"
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
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          // Capped and column-laid-out so a long body scrolls inside the panel
          // while the title and the buttons stay put — with 50 gates the Save
          // button would otherwise sit a screen and a half below the fold.
          className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
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

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer && (
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
