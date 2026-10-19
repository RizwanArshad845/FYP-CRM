import { useEffect } from 'react';
import { Navigate, createBrowserRouter, useLocation, useNavigate, useParams } from 'react-router';
import { Login } from './pages/Login';
import { Landing } from './pages/landing/Landing';
import { ClockIn } from './pages/ClockIn';
import { Dashboard } from './pages/Dashboard';
import { Signup } from './pages/onboarding/Signup';
import { OnboardingWizard } from './pages/onboarding/OnboardingWizard';
import { ChangePassword } from './pages/onboarding/ChangePassword';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PlatformLogin } from './pages/platform/PlatformLogin';
import { PlatformOrganizationDetail, PlatformOrganizations, PlatformOverview } from './pages/platform/PlatformAdmin';
import { useAuth } from './context/AuthContext';
import { orgPath } from './utils/orgPath';

// Old un-prefixed URLs (/dashboard, /clock-in, ...) move under the signed-in
// user's organization, or to the login page.
function ToOrgUrl() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (isLoading) return;
    navigate(user ? orgPath(user.organization?.slug, pathname + search) : '/login', { replace: true });
  }, [user, isLoading, navigate, pathname, search]);
  return null;
}

// /<slug> on its own opens that organization's login page
function OrgRoot() {
  const { slug } = useParams();
  return <Navigate to={orgPath(slug, '/login')} replace />;
}

const page = (path: string, Component: React.ComponentType) => ({ path, Component, ErrorBoundary });

// Each organization has its own URLs: /<slug>/login, /<slug>/dashboard, ...
export const router = createBrowserRouter([
  page('/', Landing),
  page('/login', Login),
  page('/signup', Signup),
  page('/platform/login', PlatformLogin),
  page('/platform', PlatformOverview),
  page('/platform/organizations', PlatformOrganizations),
  page('/platform/organizations/:id', PlatformOrganizationDetail),
  page('/onboarding', ToOrgUrl),
  page('/change-password', ToOrgUrl),
  page('/clock-in', ToOrgUrl),
  page('/dashboard', ToOrgUrl),
  page('/:slug', OrgRoot),
  page('/:slug/login', Login),
  page('/:slug/onboarding', OnboardingWizard),
  page('/:slug/change-password', ChangePassword),
  page('/:slug/clock-in', ClockIn),
  page('/:slug/dashboard', Dashboard),
  {
    path: '*',
    Component: () => { throw new Response("Not Found", { status: 404 }); },
    ErrorBoundary: ErrorBoundary,
  }
]);
