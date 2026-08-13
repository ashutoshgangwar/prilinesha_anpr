// src/components/icons.jsx
// Lightweight inline SVG icons (no extra dependency).

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const EyeIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const RefreshIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M20 11a8 8 0 0 0-13.7-5.3L3 9" />
    <path d="M4 13a8 8 0 0 0 13.7 5.3L21 15" />
    <path d="M3 4v5h5M21 20v-5h-5" />
  </svg>
);

export const ArrowRightIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const TrashIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6M10 11v6M14 11v6" />
  </svg>
);

export const MenuIcon = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const CloseIcon = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const DashboardIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

export const LogsIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M4 5h16M4 12h16M4 19h10" />
  </svg>
);

export const VehiclesIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M5 16V9l2-4h10l2 4v7M5 16h14M5 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M16 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M3 9h18M7.5 13h.01M16.5 13h.01" />
  </svg>
);

export const CamerasIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </svg>
);

export const LogoutIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M15 12H3m0 0 4-4m-4 4 4 4M9 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9" />
  </svg>
);

export const PlateIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10v4M10 10v4M14 10v4M18 10v4" />
  </svg>
);
