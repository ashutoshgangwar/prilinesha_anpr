// src/components/Spinner.jsx

/** Inline spinner. Pass `fullPage` to center it in a full-height container. */
export default function Spinner({ fullPage = false, label = 'Loading…' }) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        {spinner}
      </div>
    );
  }
  return <div className="flex w-full items-center justify-center py-12">{spinner}</div>;
}
