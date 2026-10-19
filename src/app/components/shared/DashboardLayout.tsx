import { ReactNode } from 'react';
import { SidebarProvider } from '../ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { type PortalTheme } from '../../styles/portal-themes';
import { useNavigation } from 'react-router';
import { LoadingScreen } from './LoadingScreen';

interface DashboardLayoutProps {
  theme: PortalTheme;
  children: ReactNode;
}

// App shell (plan 9.2): navy sidebar, then the page. Each dashboard renders its own
// top bar through DashboardHeader so the title belongs to the page.
export function DashboardLayout({ theme, children }: DashboardLayoutProps) {
  const navigation = useNavigation();
  const isNavigating = navigation.state === 'loading';

  return (
    <SidebarProvider>
      {isNavigating && <LoadingScreen message={`Preparing ${theme.label} Workspace...`} />}
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
