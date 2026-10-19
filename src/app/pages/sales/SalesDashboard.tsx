import { useAuth } from '../../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { TrendingUp, FileText, PhoneCall, Mic, Users } from 'lucide-react';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { WelcomeHero } from '../../components/shared/WelcomeHero';
import { MonthlyTargets } from './MonthlyTargets';
import { SalesRecordings } from './SalesRecordings';
import { FollowUpLeads } from './FollowUpLeads';
import { MonthlyReview } from './MonthlyReview';
import { SalesConcerns } from './SalesConcerns';
import { ImportantRecordings } from './ImportantRecordings';
import { TeamPerformance } from './TeamPerformance';
import { getPortalTheme } from '../../styles/portal-themes';
import { Notepad } from '../../components/shared/Notepad';

const MONTHLY_DATA = { revenueAchieved: 125000, revenueTarget: 150000, totalSales: 45, conversionRate: 18 };

const theme = getPortalTheme('sales');

export function SalesDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeModule = searchParams.get('module') || 'team-performance';
  const activeTab = searchParams.get('tab');

  const progressPct = Math.round((MONTHLY_DATA.revenueAchieved / MONTHLY_DATA.revenueTarget) * 100);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Sales Team Portal" theme={theme} />
      <main className="px-6 py-5">
        <div className="w-full">

          {activeModule === 'followup' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <FollowUpLeads />
            </div>
          )}

          {activeModule === 'comms' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Tabs defaultValue={activeTab || 'recordings'} className="w-full">
                <TabsList className="mb-6 flex-wrap w-full h-auto gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
                  <TabsTrigger value="recordings" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><Mic className="h-4 w-4 mr-2" />Call Recordings</TabsTrigger>
                  <TabsTrigger value="important_recordings" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><Mic className="h-4 w-4 mr-2 text-danger" />Important Calls</TabsTrigger>
                </TabsList>
                <TabsContent value="recordings"><SalesRecordings /></TabsContent>
                <TabsContent value="important_recordings"><ImportantRecordings /></TabsContent>
              </Tabs>
            </div>
          )}

          {activeModule === 'performance' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Tabs defaultValue={activeTab || 'targets'} className="w-full">
                <TabsList className="mb-6 flex-wrap w-full h-auto gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
                  <TabsTrigger value="targets" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><TrendingUp className="h-4 w-4 mr-2" />Monthly Targets</TabsTrigger>
                  <TabsTrigger value="review" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><FileText className="h-4 w-4 mr-2" />Monthly Review</TabsTrigger>
                </TabsList>
                <TabsContent value="targets"><MonthlyTargets /></TabsContent>
                <TabsContent value="review"><MonthlyReview /></TabsContent>
              </Tabs>
            </div>
          )}

          {activeModule === 'team-performance' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <TeamPerformance />
            </div>
          )}

          {activeModule === 'notepad' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Notepad />
            </div>
          )}

          {activeModule === 'concerns' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <SalesConcerns />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
