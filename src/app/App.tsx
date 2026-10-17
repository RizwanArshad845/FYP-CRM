import type { ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth, pendingSetupRoute } from './context/AuthContext';
import { EmployeeProvider } from './context/EmployeeContext';
import { ManagerTaskProvider } from './context/ManagerTaskContext';
import { CSTManagerTaskProvider } from './context/CSTManagerTaskContext';
import { ClientInboxProvider } from './context/ClientInboxContext';
import { ClientProvider } from './context/ClientContext';
import { AgentTargetProvider } from './context/AgentTargetContext';
import { FinanceProvider } from './context/FinanceContext';
import { RecordingProvider } from './context/RecordingContext';
import { CSTScheduleProvider } from './context/CSTScheduleContext';
import { AttendanceProvider } from './context/AttendanceContext';
import { PerformanceProvider } from './context/PerformanceContext';
import { ConcernProvider } from './context/ConcernContext';
import { FollowUpProvider } from './context/FollowUpContext';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';

// Data providers mount only for a fully set-up session (not during login,
// password change or onboarding), and remount whenever the user changes so
// no state from a previous session survives a logout/login.
function SessionProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user || pendingSetupRoute(user)) return <>{children}</>;
  return (
    <EmployeeProvider key={user.id}>
      <ManagerTaskProvider>
        <CSTManagerTaskProvider>
          <AgentTargetProvider>
            <FinanceProvider>
              <RecordingProvider>
                <CSTScheduleProvider>
                  <PerformanceProvider>
                    <AttendanceProvider>
                      <ClientProvider>
                        <ClientInboxProvider>
                          <ConcernProvider>
                            <FollowUpProvider>
                              {children}
                            </FollowUpProvider>
                          </ConcernProvider>
                        </ClientInboxProvider>
                      </ClientProvider>
                    </AttendanceProvider>
                  </PerformanceProvider>
                </CSTScheduleProvider>
              </RecordingProvider>
            </FinanceProvider>
          </AgentTargetProvider>
        </CSTManagerTaskProvider>
      </ManagerTaskProvider>
    </EmployeeProvider>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <SessionProviders>
          <RouterProvider router={router} />
          <Toaster />
        </SessionProviders>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}
