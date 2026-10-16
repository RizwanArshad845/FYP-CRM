import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '../ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { type PortalTheme } from '../../styles/portal-themes';
import { Separator } from '../ui/separator';
import { useNavigation } from 'react-router';
import { LoadingScreen } from './LoadingScreen';

interface DashboardLayoutProps {
  theme: PortalTheme;
  children: ReactNode;
}

export function DashboardLayout({ theme, children }: DashboardLayoutProps) {
  const navigation = useNavigation();
  const isNavigating = navigation.state === 'loading';

  return (
    <SidebarProvider>
      {isNavigating && <LoadingScreen message={`Preparing ${theme.label} Workspace...`} />}
      <div className="min-h-screen flex w-full">
        <AppSidebar theme={theme} />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar with sidebar trigger and breadcrumb */}
          <div className="h-12 flex items-center px-3 border-b bg-background/80 backdrop-blur-sm shrink-0 gap-2">
            <SidebarTrigger className="h-9 w-9 rounded-lg hover:bg-muted transition-colors" />
            <Separator orientation="vertical" className="h-5" />
            <span className="text-sm font-medium text-muted-foreground truncate">{theme.label}</span>
          </div>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
