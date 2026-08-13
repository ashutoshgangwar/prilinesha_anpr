// src/components/Sidebar.jsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import {
  DashboardIcon,
  LogsIcon,
  VehiclesIcon,
  VisitorsIcon,
  CamerasIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from './icons';

// Each gate mirrors the API. `superAdminOnly`: every /api/projects route sits
// behind requireSuperAdmin, so showing the link to anyone else only offers a
// 403. `permission`: the visitor routes are behind visitor:read, which customer
// admins hold too — so this is a real permission check rather than a role one.

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/logs', label: 'Logs', icon: LogsIcon },
  { to: '/vehicles', label: 'Vehicles', icon: VehiclesIcon },
  { to: '/visitors', label: 'Visitors', icon: VisitorsIcon, permission: 'visitor:read' },
  { to: '/projects', label: 'Projects', icon: CamerasIcon, superAdminOnly: true },
];

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
};

export default function Sidebar() {
  const { logout, user, role, isDemo, isSuperAdmin, hasPermission } = useAuth();
  const [open, setOpen] = useState(false); // mobile drawer state
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async (allDevices) => {
    setSigningOut(true);
    try {
      await logout({ allDevices });
    } finally {
      setSigningOut(false);
    }
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-500 text-white'
        : 'text-ink-100 hover:bg-ink-800 hover:text-white'
    }`;

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo / app name */}
      <div className="flex items-center gap-3 border-b border-ink-700 px-5 py-4">
        <Logo className="h-10 w-10" boxed />
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight text-white">
            ANPR Dashboard
          </p>
          <p className="truncate text-xs text-ink-400">Prilinesha Tech</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.filter(
          (item) =>
            (!item.superAdminOnly || isSuperAdmin) &&
            (!item.permission || hasPermission(item.permission))
        ).map(
          ({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          )
        )}
      </nav>

      {/* Signed-in user + logout */}
      <div className="border-t border-ink-700 p-3">
        {user && (
          <div className="mb-2 px-3 py-2">
            <p className="truncate text-sm font-medium text-white">
              {user.name || user.email}
            </p>
            <p className="truncate text-xs text-ink-400">
              {ROLE_LABELS[role] || role || 'User'}
              {isDemo && ' · demo'}
            </p>
          </div>
        )}

        <button
          onClick={() => signOut(false)}
          disabled={signingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-100 transition-colors hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogoutIcon className="h-5 w-5" />
          <span>{signingOut ? 'Signing out…' : 'Logout'}</span>
        </button>

        {/* Ends every session and retires outstanding access tokens. */}
        <button
          onClick={() => signOut(true)}
          disabled={signingOut}
          className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-xs text-ink-400 transition-colors hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sign out of all devices
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-ink-900 px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8" boxed />
          <span className="font-bold">ANPR Dashboard</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 bg-ink-900 md:block">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-ink-900 shadow-xl">
            <div className="flex justify-end p-2">
              <button
                onClick={() => setOpen(false)}
                className="text-ink-100 hover:text-white"
                aria-label="Close menu"
              >
                <CloseIcon />
              </button>
            </div>
            {SidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
