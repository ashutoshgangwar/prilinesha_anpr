// src/components/Logo.jsx

/**
 * The Prilinesha Tech mark (public/logo_main.jpeg).
 *
 * The source file is a JPEG, so it carries its own near-white background rather
 * than transparency. On light surfaces it blends in; on the dark sidebar it is
 * boxed into a light rounded tile so the square never reads as a stray patch.
 */
export default function Logo({ className = 'h-10 w-10', boxed = false }) {
  const img = (
    <img
      src="/logo_main.jpeg"
      alt="Prilinesha Tech"
      className={`${className} object-contain ${boxed ? '' : 'rounded-lg'}`}
    />
  );

  if (!boxed) return img;

  return (
    <span className="inline-flex items-center justify-center overflow-hidden rounded-lg bg-white p-0.5">
      {img}
    </span>
  );
}
