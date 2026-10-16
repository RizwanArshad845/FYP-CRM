import { createHashRouter } from 'react-router';
import { Login } from './pages/Login';
import { ClockIn } from './pages/ClockIn';
import { Dashboard } from './pages/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

export const router = createHashRouter([
  {
    path: '/',
    Component: Login,
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: '/login',
    Component: Login,
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: '/clock-in',
    Component: ClockIn,
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: '/dashboard',
    Component: Dashboard,
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: '*',
    Component: () => { throw new Response("Not Found", { status: 404 }); },
    ErrorBoundary: ErrorBoundary,
  }
]);
