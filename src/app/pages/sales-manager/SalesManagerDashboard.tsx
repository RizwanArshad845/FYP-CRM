import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { TrendingUp, Users, Target, ClipboardCheck, AlertCircle, Mic } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { WelcomeHero } from '../../components/shared/WelcomeHero';
import { StatCard } from '../../components/shared/StatCard';
import { cls } from '../../styles/classes';
import { AgentPerformance } from '../sales/AgentPerformance';
import { ManagerTaskBoard } from './ManagerTaskBoard';
import { MonthlyTargets } from '../sales/MonthlyTargets';
import { FollowUpLeads } from '../sales/FollowUpLeads';
import { SalesConcerns } from '../sales/SalesConcerns';
import { ImportantRecordings } from '../sales/ImportantRecordings';
import { ClientEntryForm } from './ClientEntryForm';
import { useAgentTargets } from '../../context/AgentTargetContext';
import { useEmployees } from '../../context/EmployeeContext';
import { useOrgPath } from '../../context/AuthContext';
import { toast } from 'sonner';
import { getPortalTheme } from '../../styles/portal-themes';
import { Notepad } from '../../components/shared/Notepad';

const theme = getPortalTheme('sales_manager');


function TargetsOverview() {
    const { targets, assignTarget, updateTarget } = useAgentTargets();
    const { employees, isLoading } = useEmployees();
    const [assignAgentId, setAssignAgentId] = useState<number>(0);
    const [assignAmount, setAssignAmount] = useState('');
    const [editingTargetId, setEditingTargetId] = useState<number | null>(null);

    const now = new Date();
    const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // Case-insensitive role filter to avoid 'sales' vs 'Sales Agent' issues
    // AND filter out agents who already have a target for the current month
    const salesAgents = employees.filter(e => {
        const roleName = String(e.role || '').toLowerCase().trim();
        const isSales = roleName === 'sales' || roleName === 'sales_manager' || roleName === 'sales agent' || roleName === 'sales manager';
        if (!isSales) return false;

        // Check if agent already has a target for the current month
        const hasTargetThisMonth = targets.some(t => t.agentId === Number(e.id) && t.month === currentMonthLabel);
        return !hasTargetThisMonth;
    });



    const handleAssign = () => {
        if (!assignAgentId || !assignAmount) { toast.error('Select an agent and enter a target amount'); return; }
        const numericAmount = Number(assignAmount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            toast.error('Target amount must be a positive number');
            return;
        }
        const agent = salesAgents.find(a => Number(a.id) === assignAgentId);

        if (editingTargetId) {
            updateTarget(editingTargetId, assignAgentId, numericAmount);
            setEditingTargetId(null);
        } else {
            assignTarget(agent?.name || 'Agent', assignAgentId, numericAmount);
            toast.success(`Target of $${numericAmount.toLocaleString()} assigned to ${agent?.name}`);
        }

        setAssignAgentId(0);
        setAssignAmount('');
    };



    const cancelEdit = () => {
        setAssignAgentId(0);
        setAssignAmount('');
        setEditingTargetId(null);
    };

    if (isLoading) return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading team data...</div>;

    return (
        <div className={cls.page}>
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className={cls.inline}><Target className="h-5 w-5" />Assign Targets</CardTitle>
                    <CardDescription>Assign monthly revenue targets to sales agents</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 flex-wrap items-end">
                        <div className={`${cls.field} flex-1 min-w-[200px]`}>
                            <Label>Agent</Label>
                            <Select value={assignAgentId.toString()} onValueChange={v => setAssignAgentId(Number(v))}>
                                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                                <SelectContent>
                                    {salesAgents.length > 0 ? (
                                        salesAgents.map(a => (
                                            <SelectItem key={a.id} value={a.id.toString()}>{a.name} — {a.role}</SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="0" disabled>No agents found</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className={`${cls.field} flex-1 min-w-[200px]`}>
                            <Label>Target Amount ($)</Label>
                            <Input
                                type="number"
                                min="1"
                                placeholder="150000"
                                value={assignAmount}
                                onChange={e => {
                                    const val = e.target.value;
                                    // Prevent negative values from being typed
                                    if (val === '' || Number(val) >= 0) setAssignAmount(val);
                                }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleAssign}>
                                <Target className="h-4 w-4 mr-2" />
                                {editingTargetId ? 'Update Target' : 'Assign Target'}
                            </Button>
                            {editingTargetId && (
                                <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}

export function SalesManagerDashboard() {
    const { employees } = useEmployees();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const to = useOrgPath();
    const activeModule = searchParams.get('module') || 'overview';
    const activeTab = searchParams.get('tab');

    const INITIAL_AGENTS = employees.filter(e => String(e.role || '').toLowerCase().includes('sales')).map(e => ({ ...e, overallScore: (e as any).overallScore || 85 }));
    const totalAgents = INITIAL_AGENTS.length;
    const avgScore = totalAgents > 0 ? Math.round(INITIAL_AGENTS.reduce((s, a) => s + (a.overallScore || 0), 0) / totalAgents) : 0;

    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader title="Sales Manager Portal" theme={theme} />
            <main className="px-6 py-5">
                <div className="w-full">
                    {activeModule === 'overview' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                            <WelcomeHero theme={theme}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-semibold mb-1 text-foreground">Team Management</h2>
                                        <p className="text-sm text-muted-foreground">Monitor targets, performance, and follow-ups</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-foreground">{totalAgents}</p>
                                            <p className="text-xs text-muted-foreground">Agents</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{avgScore}%</p>
                                            <p className="text-xs text-muted-foreground">Avg Score</p>
                                        </div>
                                    </div>
                                </div>
                            </WelcomeHero>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(to('/dashboard?module=team&tab=performance'))}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                            Team Performance
                                            <Users className="h-4 w-4 text-blue-500" />
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{avgScore}%</div>
                                        <p className="text-xs text-muted-foreground mt-1">Average agent score</p>
                                    </CardContent>
                                </Card>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(to('/dashboard?module=mytasks'))}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                            Manager Tasks
                                            <ClipboardCheck className="h-4 w-4 text-orange-500" />
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">Review Desk</div>
                                        <p className="text-xs text-muted-foreground mt-1">Manage pending actions</p>
                                    </CardContent>
                                </Card>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(to('/dashboard?module=concerns'))}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                            Team Concerns
                                            <AlertCircle className="h-4 w-4 text-red-500" />
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">Open Tickets</div>
                                        <p className="text-xs text-muted-foreground mt-1">Resolution required</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeModule === 'team' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <Tabs defaultValue={activeTab || 'targets'} className="w-full">
                                <TabsList className="mb-6 flex-wrap w-full h-auto gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
                                    <TabsTrigger value="targets" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><TrendingUp className="h-4 w-4 mr-2" />Team Targets</TabsTrigger>
                                    <TabsTrigger value="performance" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><Users className="h-4 w-4 mr-2" />Agent Performance</TabsTrigger>
                                </TabsList>
                                <TabsContent value="targets"><TargetsOverview /></TabsContent>
                                <TabsContent value="performance"><AgentPerformance /></TabsContent>
                            </Tabs>
                        </div>
                    )}

                    {activeModule === 'mytasks' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <ManagerTaskBoard />
                        </div>
                    )}

                    {activeModule === 'followup' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <FollowUpLeads />
                        </div>
                    )}

                    {activeModule === 'recordings' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <ImportantRecordings />
                        </div>
                    )}

                    {activeModule === 'self' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <MonthlyTargets />
                        </div>
                    )}

                    {activeModule === 'entry' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <ClientEntryForm />
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
