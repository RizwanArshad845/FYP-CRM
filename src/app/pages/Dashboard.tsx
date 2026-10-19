import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth, pendingSetupRoute, nextRouteFor, useOrgPath } from '../context/AuthContext';
import { DashboardLayout } from '../components/shared/DashboardLayout';
import { getPortalTheme } from '../styles/portal-themes';
import { usePortals } from '../hooks/usePortals';
import { PORTAL_NAV } from '../config/portalNav';

export function Dashboard() {
  const { user, isLoading } = useAuth();
  const { labelFor, isEnabled } = usePortals();
  const navigate = useNavigate();
  const to = useOrgPath();
  const { slug } = useParams();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate(to('/login')); return; }
    // A session always lives under its own organization's URL
    if (slug !== user.organization?.slug) { navigate(nextRouteFor(user), { replace: true }); return; }
    const setup = pendingSetupRoute(user);
    if (setup) { navigate(setup); return; }
    if (!user.clockedIn) { navigate(to('/clock-in')); return; }
  }, [user, isLoading, navigate, to, slug]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading dashboard...</div></div>;
  if (!user || !user.clockedIn || pendingSetupRoute(user) || slug !== user.organization?.slug) return null;

  const portal = user.role;
  if (!isEnabled(portal)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center text-muted-foreground">
        Your portal is disabled for this organization
      </div>
    );
  }

  // Fixed mapping from portal type to dashboard (plan 5.2); colors stay tied to the portal type.
  const DashboardComponent = PORTAL_NAV[portal]?.component;
  if (!DashboardComponent) return <div>Unknown portal</div>;
  const theme = { ...getPortalTheme(portal), label: `${labelFor(portal)} Portal` };

  return (
    <DashboardLayout theme={theme}>
      <DashboardComponent />
    </DashboardLayout>
  );
}
