# ANPR Dashboard

A React.js frontend for a License Plate Recognition (LPR) gate management
system. It talks to a backend at `http://localhost:5050` and provides login /
signup, a stats dashboard, log browsing with image previews, and vehicle /
camera management.

## Tech stack

- React 18 + Vite
- React Router v6 (`createBrowserRouter`)
- Axios (single instance with auth + refresh interceptors)
- date-fns (date formatting)
- Tailwind CSS

## Getting started

```bash
npm install
npm run dev      # start dev server (default http://localhost:5173)
npm run build    # production build
npm run preview  # preview the production build
```

The backend base URL is configured in [`src/api/axios.js`](src/api/axios.js)
as `BASE_URL = 'http://localhost:5050'`.

## Authentication

- `POST /api/auth/login` and `POST /api/auth/signup` return
  `{ accessToken, refreshToken }`.
- The **access token is held in memory only** (never localStorage).
- The **refresh token lives in an httpOnly cookie** set by the backend; every
  request is sent with `withCredentials: true`.
- Every request attaches `Authorization: Bearer <accessToken>`.
- On a `401`, the axios response interceptor calls `POST /api/auth/refresh`,
  retries the original request, and — if refresh fails — clears the token and
  redirects to `/login`. Concurrent 401s are queued so only one refresh runs.
- On app load, a silent refresh attempts to restore the session from the cookie.

## Project structure

```
src/
├── api/
│   └── axios.js              axios instance, interceptors, token refresh
├── context/
│   ├── AuthContext.jsx       login, logout, signup, token state
│   └── ToastContext.jsx      success/error toast notifications
├── pages/
│   ├── Login.jsx
│   ├── Signup.jsx
│   ├── Dashboard.jsx         stats overview + recent logs
│   ├── Logs.jsx              filterable, paginated logs table
│   ├── Vehicles.jsx          registered vehicles + add form
│   └── Cameras.jsx           camera config + add form
├── components/
│   ├── Sidebar.jsx           navigation sidebar (collapsible on mobile)
│   ├── ProtectedRoute.jsx    auth guard + app shell layout
│   ├── DataTable.jsx         reusable table (loading + empty states)
│   ├── Filters.jsx           filter bar for logs
│   ├── LogImageModal.jsx     event_image + plate_image (base64) viewer
│   ├── Badge.jsx             colored status badges
│   ├── Spinner.jsx           loading spinner
│   ├── icons.jsx             inline SVG icons
│   └── logColumns.jsx        shared log table columns
├── utils/
│   └── format.js             date formatting + response/error helpers
├── App.jsx                   router + providers
└── main.jsx                  entry point
```

## API endpoints used

| Area      | Calls |
|-----------|-------|
| Auth      | `POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/refresh`, `POST /api/auth/logout` |
| Logs      | `GET /api/logs?page=&limit=20&vehicle_number=&event_type=&from=&to=`, `GET /api/logs/:id`, `DELETE /api/logs/:id` |
| Vehicles  | `GET /api/vehicles`, `POST /api/vehicles`, `DELETE /api/vehicles/:id` |
| Cameras   | `GET /api/cameras`, `POST /api/cameras`, `DELETE /api/cameras/:id` |

List responses are normalized in `utils/format.js`, so the table pages work
whether the backend returns a bare array or `{ data, total }` / `{ logs, count }`
shapes. Dashboard counts use the `total` field from `limit=1` queries.

## Notes

- All app pages sit behind `ProtectedRoute` — without an access token you are
  redirected to `/login`.
- No tokens are hardcoded; nothing is stored in localStorage.
- Tables show a "No data found" empty state and a spinner while loading.
- Add / delete actions show toast notifications and confirm before deleting.
