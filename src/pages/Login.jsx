// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { PlateIcon, VehiclesIcon, CamerasIcon } from '../components/icons';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d[\d\s-]{6,}$/; // basic phone format (7+ digits)

// The backend sends a `message` for each of these; these are only the fallbacks
// used when it doesn't. 401 is deliberately identical for a wrong email and a
// wrong password, so this must not hint at which one was wrong.
// Shown on the brand panel only — copy, not configuration.
const HIGHLIGHTS = [
  {
    icon: PlateIcon,
    title: 'Live plate detection',
    body: 'Every read logged with its plate, gate and timestamp.',
  },
  {
    icon: VehiclesIcon,
    title: 'Registered vehicles',
    body: 'Keep the allow-list current and see who changed what.',
  },
  {
    icon: CamerasIcon,
    title: 'Project-scoped access',
    body: 'Users only ever see the sites they are assigned to.',
  },
];

const LOGIN_ERRORS = {
  400: 'Please check the details you entered and try again.',
  401: 'Invalid email or password.',
  403: 'This account has been deactivated. Contact your administrator.',
  429: 'Too many attempts. Please wait a moment and try again.',
};

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already logged in? Skip the form.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    const id = form.email.trim();
    if (!id) next.email = 'Email or phone is required';
    else if (!EMAIL_RE.test(id) && !PHONE_RE.test(id))
      next.email = 'Enter a valid email or phone number';
    if (!form.password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      navigate('/', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const fallback =
        LOGIN_ERRORS[status] ||
        (status == null
          ? 'Could not reach the server. Please try again.'
          : 'Sign in failed. Please try again.');
      // Prefer the backend's own message; fall back to ours rather than to
      // axios's raw "Network Error" text.
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error;
      setServerError(serverMsg || fallback);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
      errors[field]
        ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
    }`;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ── Left: brand panel. Hidden below lg, where the compact header inside
             the form column carries the logo instead. ── */}
      <aside className="relative hidden overflow-hidden bg-brand-700 lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Soft light bloom so the flat brand colour has some depth */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 25% 15%, rgba(255,255,255,0.16), transparent 55%), linear-gradient(160deg, transparent 40%, rgba(31,31,30,0.55) 100%)',
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-4">
            <Logo className="h-14 w-14" boxed />
            <div>
              <p className="text-lg font-bold leading-tight text-white">
                Prilinesha Tech
              </p>
              <p className="text-sm text-brand-200">ANPR Dashboard</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-snug text-white">
            Every plate, every gate — in one place.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-brand-200">
            Automatic number plate recognition with live detection logs,
            registered-vehicle management and per-project access control.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-brand-200">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-200/70">
          © {new Date().getFullYear()} Prilinesha Tech. All rights reserved.
        </p>
      </aside>

      {/* ── Right: sign-in form ── */}
      <main className="flex min-h-screen items-center justify-center bg-ink-100 px-4 py-10 lg:min-h-0 lg:bg-white">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg lg:rounded-none lg:p-0 lg:shadow-none">
          {/* Compact brand header — the left panel's job on large screens */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Logo className="mb-3 h-20 w-20" />
            <p className="text-base font-bold text-gray-900">Prilinesha Tech</p>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-500">
              Sign in to your ANPR Dashboard account.
            </p>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Email or phone
              </label>
              <input
                type="text"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputClass('email')}
                placeholder="you@example.com or 9999999999"
                autoComplete="username"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className={inputClass('password')}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-ink-400">
            Accounts are created by your administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
