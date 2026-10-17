import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth, pendingSetupRoute } from '../context/AuthContext';
import { DashboardLayout } from '../components/shared/DashboardLayout';
import { AdminDashboard } from './admin/AdminDashboard';
import { SalesDashboard } from './sales/SalesDashboard';
import { SalesManagerDashboard } from './sales-manager/SalesManagerDashboard';
import { FinanceDashboard } from './finance/FinanceDashboard';
import { CSTDashboard } from './cst/CSTDashboard';
import { CSTManagerDashboard } from './cst-manager/CSTManagerDashboard';
import { getPortalTheme } from '../styles/portal-themes';
import { usePortals } from '../hooks/usePortals';

export function Dashboard() {
  const { user, isLoading } = useAuth();
  const { labelFor } = usePortals();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate('/login'); return; }
    const setup = pendingSetupRoute(user);
    if (setup) { navigate(setup); return; }
    if (!user.clockedIn) { navigate('/clock-in'); return; }
  }, [user, isLoading, navigate]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading dashboard...</div></div>;
  if (!user || !user.clockedIn || pendingSetupRoute(user)) return null;

  // The org may have renamed its portals; colors stay tied to the portal type.
  const theme = { ...getPortalTheme(user.role), label: `${labelFor(user.role)} Portal` };

  const DashboardComponent = {
    admin: AdminDashboard,
    sales: SalesDashboard,
    sales_manager: SalesManagerDashboard,
    finance: FinanceDashboard,
    cst: CSTDashboard,
    cst_manager: CSTManagerDashboard,
  }[user.role];

  if (!DashboardComponent) return <div>Unknown role</div>;

  return (
    <DashboardLayout theme={theme}>
      <DashboardComponent />
    </DashboardLayout>
  );
}
