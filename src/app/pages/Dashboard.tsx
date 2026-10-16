import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/shared/DashboardLayout';
import { AdminDashboard } from './admin/AdminDashboard';
import { SalesDashboard } from './sales/SalesDashboard';
import { SalesManagerDashboard } from './sales-manager/SalesManagerDashboard';
import { FinanceDashboard } from './finance/FinanceDashboard';
import { CSTDashboard } from './cst/CSTDashboard';
import { CSTManagerDashboard } from './cst-manager/CSTManagerDashboard';
import { getPortalTheme } from '../styles/portal-themes';

export function Dashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate('/login'); return; }
    if (!user.clockedIn) { navigate('/clock-in'); return; }
  }, [user, isLoading, navigate]);

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading dashboard...</div></div>;
  if (!user || !user.clockedIn) return null;

  const theme = getPortalTheme(user.role);

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
