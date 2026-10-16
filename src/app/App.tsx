import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { AuthProvider } from './context/AuthContext';
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

export default function App() {
  // Auto-update notifications
  // Listens for update events sent from electron/main.js via IPC.
  // Shows a subtle toast — does NOT interrupt the user's workflow.
  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return;

    window.electronAPI.onUpdateStatus((status) => {
      if (status === 'downloading') {
        toast.info('⬇ Downloading update in background…', {
          duration: 4000,
          description: 'The app will update automatically on next restart.',
        });
      } else if (status === 'ready') {
        toast.success('✅ Update ready!', {
          duration: 8000,
          description: 'Restart the app to apply the latest version.',
        });
      }
    });

    return () => {
      window.electronAPI?.removeUpdateListener();
    };
  }, []);

  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <EmployeeProvider>
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
                                  <RouterProvider router={router} />
                                  <Toaster />
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
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}
