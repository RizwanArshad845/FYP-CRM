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
import { useManagerTasks } from '../../context/ManagerTaskContext';
import { useConcerns } from '../../context/ConcernContext';
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

    const { targets } = useAgentTargets();
    const { tasks } = useManagerTasks();
    const { externalConcerns, internalConcerns } = useConcerns();

    // Real figures for the overview: team size, sales target attainment, open work
    const totalAgents = employees.filter(e => String(e.role || '').toLowerCase() === 'sales').length;
    const salesTargets = targets.filter(t => t.type === 'sales');
    const targetSum = salesTargets.reduce((sum, t) => sum + (t.target || 0), 0);
    const attainment = targetSum > 0 ? Math.round((salesTargets.reduce((sum, t) => sum + (t.achieved || 0), 0) / targetSum) * 100) : 0;
    const openTasks = tasks.filter(t => !['completed', 'approved'].includes(String(t.status))).length;
    const openConcerns = [...externalConcerns, ...internalConcerns].filter(c => ['pending', 'open'].includes(String(c.status).toLowerCase())).length;

    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader title="Sales Manager Portal" theme={theme} />
            <main className="px-6 py-5">
                <div className="w-full">
                    {activeModule === 'overview' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                            <WelcomeHero
                                title="Team management"
                                description="Monitor targets, performance and follow-ups across your sales team."
                                metrics={[
                                    { label: 'Agents', value: totalAgents },
                                    { label: 'Target achieved', value: `${attainment}%` },
                                ]}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatCard tone="primary" icon={<Users />} title="Team performance" value={`${attainment}%`}
                                    subtitle="Of this team's sales targets" onClick={() => navigate(to('/dashboard?module=team&tab=performance'))} />
                                <StatCard tone="warning" icon={<ClipboardCheck />} title="Manager tasks" value={openTasks}
                                    subtitle={openTasks === 1 ? 'Task waiting for you' : 'Tasks waiting for you'} onClick={() => navigate(to('/dashboard?module=mytasks'))} />
                                <StatCard tone="danger" icon={<AlertCircle />} title="Team concerns" value={openConcerns}
                                    subtitle="Open and awaiting resolution" onClick={() => navigate(to('/dashboard?module=concerns'))} />
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
