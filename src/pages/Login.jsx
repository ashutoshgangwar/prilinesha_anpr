// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/format';
import { PlateIcon } from '../components/icons';
import { DEMO } from '../config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d[\d\s-]{6,}$/; // basic phone format (7+ digits)

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

  const fillDemo = () => {
    setForm({ email: DEMO.email, password: DEMO.password });
    setErrors({});
    setServerError('');
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
      setServerError(getErrorMessage(err, 'Invalid email or password'));
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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-2 text-brand-500">
            <PlateIcon className="h-10 w-10" />
          </span>
          <h1 className="text-2xl font-bold text-gray-900">ANPR Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>

        {serverError && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {DEMO.enabled && (
          <div className="mt-6 rounded-lg border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-gray-600">
            <p className="font-medium text-gray-700">Demo login</p>
            <p className="mt-1">
              No backend? Use{' '}
              <span className="font-mono text-gray-800">{DEMO.email}</span> /{' '}
              <span className="font-mono text-gray-800">{DEMO.password}</span>
              {DEMO.allowAnyCredentials
                ? ' — or any email/phone + password.'
                : '.'}
            </p>
            <button
              type="button"
              onClick={fillDemo}
              className="mt-2 font-medium text-brand-600 hover:underline"
            >
              Fill demo credentials
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
