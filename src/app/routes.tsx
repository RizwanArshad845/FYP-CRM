import { createBrowserRouter } from 'react-router';
import { Login } from './pages/Login';
import { ClockIn } from './pages/ClockIn';
import { Dashboard } from './pages/Dashboard';
import { Signup } from './pages/onboarding/Signup';
import { OnboardingWizard } from './pages/onboarding/OnboardingWizard';
import { ChangePassword } from './pages/onboarding/ChangePassword';
import { ErrorBoundary } from './components/ErrorBoundary';

export const router = createBrowserRouter([
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
    path: '/signup',
    Component: Signup,
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: '/onboarding',
    Component: OnboardingWizard,
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: '/change-password',
    Component: ChangePassword,
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
