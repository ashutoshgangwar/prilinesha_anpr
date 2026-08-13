// src/App.jsx
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
} from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Vehicles from './pages/Vehicles';
import Visitors from './pages/Visitors';
import Projects from './pages/Projects';

/**
 * Root element of every route. It lives INSIDE the router (rendered by
 * createBrowserRouter) so the providers below can safely use router hooks
 * such as useNavigate.
 */
function RootProviders() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </ToastProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <RootProviders />,
    children: [
      // Public routes — sign-up is not self-service; admins create accounts.
      { path: '/login', element: <Login /> },

      // Protected app shell (sidebar + page content)
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/logs', element: <Logs /> },
          { path: '/vehicles', element: <Vehicles /> },
          { path: '/visitors', element: <Visitors /> },
          { path: '/projects', element: <Projects /> },
        ],
      },

      // Fallback → send unknown paths to login (which forwards if authed)
      { path: '*', element: <Login /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
