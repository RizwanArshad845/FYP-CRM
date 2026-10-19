import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Inbox, Users, BookOpen, Target, Globe, ClipboardCheck, AlertTriangle, Table } from 'lucide-react';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { WelcomeHero } from '../../components/shared/WelcomeHero';
import { useClientInbox } from '../../context/ClientInboxContext';
import { useClients } from '../../context/ClientContext';
import { useCSTManagerTasks } from '../../context/CSTManagerTaskContext';
import { getPortalTheme } from '../../styles/portal-themes';
import { Calendar as CalendarIcon, Presentation } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useCSTSchedule, Schedule as CSTSchedule } from '../../context/CSTScheduleContext';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

import { InboxPanel }         from './InboxPanel';
import { AssignedPanel }      from './AssignedPanel';
import { ActiveClientsPanel } from './ActiveClientsPanel';
import { StrategiesPanel }    from './StrategiesPanel';
import { TargetsPanel }       from './TargetsPanel';
import { TasksPanel }         from './TasksPanel';
import { DeactivationPanel }  from './DeactivationPanel';
import { DiscardedPanel }     from './DiscardedPanel';
import { TemplatesPanel }     from './TemplatesPanel';
import { ResourceBoard }      from './ResourceBoard';
import { CSTAgentPerformance} from './CSTAgentPerformance';
import { MasterClientTable } from './MasterClientTable';

const theme = getPortalTheme('cst_manager');

type ScheduleForm = { title: string; description: string; start_time: string; end_time: string };
const EMPTY_SCHEDULE_FORM: ScheduleForm = { title: '', description: '', start_time: '', end_time: '' };

import { useSearchParams } from 'react-router';

export function CSTManagerDashboard() {
    const { user } = useAuth();
    const { inboxClients } = useClientInbox();
    const { deactivationRequests } = useClients();
    const { tasks } = useCSTManagerTasks();
    const { schedules, addSchedule, updateSchedule, deleteSchedule } = useCSTSchedule();
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(EMPTY_SCHEDULE_FORM);
    const [searchParams] = useSearchParams();
    const activeModule = searchParams.get('module') || 'client-ops';

    const pendingCount = inboxClients.filter(c => (c.status === 'onboarding' || c.status === 'new' || (c.status as string) === 'existing') && !c.cst_agent_id).length;
    const deactivationCount = deactivationRequests.length;
    const adminTaskCount = tasks.filter(t => t.assignedBy === 'admin' && t.status !== 'completed').length;

    // Schedule helpers
    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString();
    const isUpcoming = (start: string) => new Date(start) > new Date();

    const openScheduleModal = (sch?: CSTSchedule) => {
        if (sch) {
            setEditingScheduleId(sch.id);
            setScheduleForm({
                title: sch.title,
                description: sch.description,
                start_time: sch.start_time.slice(0, 16),
                end_time: sch.end_time.slice(0, 16),
            });
        } else {
            setEditingScheduleId(null);
            setScheduleForm(EMPTY_SCHEDULE_FORM);
        }
        setIsScheduleOpen(true);
    };

    const handleScheduleSubmit = async () => {
        if (!scheduleForm.title || !scheduleForm.start_time || !scheduleForm.end_time) {
            toast.error('Required fields missing');
            return;
        }

        const now = new Date();
        const start = new Date(scheduleForm.start_time);
        const end = new Date(scheduleForm.end_time);

        if (start < now && !editingScheduleId) {
            toast.error('Cannot schedule tasks in the past');
            return;
        }

        if (end <= start) {
            toast.error('End time must be after start time');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingScheduleId !== null) {
                await updateSchedule(editingScheduleId, scheduleForm);
            } else {
                await addSchedule({ ...scheduleForm, user_id: user?.id as number });
            }
            setIsScheduleOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <DashboardHeader title="CST Manager Portal" theme={theme} />
            <main className="px-6 py-5">
                {/* Welcome Hero */}
                {activeModule === 'client-ops' && (
                    <WelcomeHero
                        title="Client operations"
                        description="Assign new clients, plan strategies and keep the inbox clear."
                        metrics={[
                            { label: 'Pending inbox', value: pendingCount, alert: pendingCount > 0 },
                            { label: 'Total clients', value: inboxClients.length },
                        ]}
                    />
                )}

                <div className="w-full">
                    {/* Main Content Area (Horizontal Tabs based on selected module) */}
                    <div className="flex-1 min-w-0">
                        {activeModule === 'client-ops' && (
                            <Tabs defaultValue="inbox" className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
                                <TabsList className="mb-6 flex-wrap w-full justify-start h-auto gap-1 bg-muted/50 p-1.5 rounded-xl border border-border/50">
                                    <TabsTrigger value="inbox" className="relative rounded-lg data-[state=active]:shadow-sm">
                                        <Inbox className="h-4 w-4 mr-2" /> Inbox
                                        {pendingCount > 0 && <span className="ml-2 inline-flex items-center justify-center h-4 w-4 rounded-full bg-danger text-white text-[10px] font-bold">{pendingCount}</span>}
                                    </TabsTrigger>
                                    <TabsTrigger value="assigned" className="rounded-lg data-[state=active]:shadow-sm"><Users className="h-4 w-4 mr-2" />Assigned</TabsTrigger>
                                    <TabsTrigger value="active" className="rounded-lg data-[state=active]:shadow-sm"><Globe className="h-4 w-4 mr-2" />Active</TabsTrigger>
                                    <TabsTrigger value="discarded" className="rounded-lg data-[state=active]:shadow-sm"><Trash2 className="h-4 w-4 mr-2" />Discarded</TabsTrigger>
                                    <TabsTrigger value="master-table" className="rounded-lg data-[state=active]:shadow-sm"><Table className="h-4 w-4 mr-2" />Client Table</TabsTrigger>
                                </TabsList>
                                <TabsContent value="inbox"><InboxPanel /></TabsContent>
                                <TabsContent value="assigned"><AssignedPanel /></TabsContent>
                                <TabsContent value="active"><ActiveClientsPanel /></TabsContent>
                                <TabsContent value="discarded"><DiscardedPanel /></TabsContent>
                                <TabsContent value="master-table"><MasterClientTable /></TabsContent>
                            </Tabs>
                        )}

                        {activeModule === 'agent-management' && (
                            <Tabs defaultValue="performance" className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
                                <TabsList className="mb-6 flex-wrap w-full justify-start h-auto gap-1 bg-muted/50 p-1.5 rounded-xl border border-border/50">
                                    <TabsTrigger value="performance" className="rounded-lg data-[state=active]:shadow-sm"><Users className="h-4 w-4 mr-2" />Performance</TabsTrigger>
                                    <TabsTrigger value="targets" className="rounded-lg data-[state=active]:shadow-sm"><Target className="h-4 w-4 mr-2" />Targets</TabsTrigger>
                                    <TabsTrigger value="tasks" className="relative rounded-lg data-[state=active]:shadow-sm">
                                        <ClipboardCheck className="h-4 w-4 mr-2" /> Tasks
                                        {adminTaskCount > 0 && <span className="ml-2 inline-flex items-center justify-center h-4 w-4 rounded-full bg-warning text-white text-[10px] font-bold">{adminTaskCount}</span>}
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="performance"><CSTAgentPerformance/></TabsContent>
                                <TabsContent value="targets"><TargetsPanel /></TabsContent>
                                <TabsContent value="tasks"><TasksPanel /></TabsContent>
                            </Tabs>
                        )}

                        {activeModule === 'strategy-resources' && (
                            <Tabs defaultValue="strategies" className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
                                <TabsList className="mb-6 flex-wrap w-full justify-start h-auto gap-1 bg-muted/50 p-1.5 rounded-xl border border-border/50">
                                    <TabsTrigger value="strategies" className="rounded-lg data-[state=active]:shadow-sm"><BookOpen className="h-4 w-4 mr-2" />Strategies</TabsTrigger>
                                    <TabsTrigger value="templates" className="rounded-lg data-[state=active]:shadow-sm"><BookOpen className="h-4 w-4 mr-2" />Templates</TabsTrigger>
                                    <TabsTrigger value="resource-board" className="rounded-lg data-[state=active]:shadow-sm"><Presentation className="h-4 w-4 mr-2" />Resource Board</TabsTrigger>
                                </TabsList>
                                <TabsContent value="strategies"><StrategiesPanel /></TabsContent>
                                <TabsContent value="templates"><TemplatesPanel /></TabsContent>
                                <TabsContent value="resource-board"><ResourceBoard /></TabsContent>
                            </Tabs>
                        )}

                        {activeModule === 'requests-actions' && (
                            <Tabs defaultValue="deactivation" className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
                                <TabsList className="mb-6 flex-wrap w-full justify-start h-auto gap-1 bg-muted/50 p-1.5 rounded-xl border border-border/50">
                                    <TabsTrigger value="deactivation" className="relative rounded-lg data-[state=active]:shadow-sm">
                                        <AlertTriangle className="h-4 w-4 mr-2" /> Deactivations
                                        {deactivationCount > 0 && <span className="ml-2 inline-flex items-center justify-center h-4 w-4 rounded-full bg-warning text-white text-[10px] font-bold">{deactivationCount}</span>}
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="deactivation"><DeactivationPanel /></TabsContent>
                            </Tabs>
                        )}

                        {activeModule === 'calendar' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5 text-primary" />Team Calender</CardTitle>
                                                <CardDescription>View and manage scheduled check-ins and meetings</CardDescription>
                                            </div>
                                            <Button onClick={() => openScheduleModal()} className="bg-primary hover:bg-primary text-white shadow-lg">
                                                <Plus className="h-4 w-4 mr-2" />Add Entry
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {schedules.map(sch => (
                                                <div key={sch.id} className={`p-4 rounded-xl border flex items-center justify-between gap-4 hover:shadow-md transition-all ${!isUpcoming(sch.start_time) ? 'bg-muted/30 opacity-60' : 'bg-card border-primary/30 '}`}>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-bold truncate">{sch.title}</h4>
                                                            <Badge variant={isUpcoming(sch.start_time) ? 'default' : 'secondary'} className="text-[10px] h-4">
                                                                {isUpcoming(sch.start_time) ? 'Upcoming' : 'Passed'}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground line-clamp-1">{sch.description || 'No description provided'}</p>
                                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-medium">
                                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(sch.start_time)} - {formatTime(sch.end_time)}</span>
                                                            <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{formatDate(sch.start_time)}</span>
                                                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{sch.user_name || 'Agent'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openScheduleModal(sch)}><Edit className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => deleteSchedule(sch.id)}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {schedules.length === 0 && (
                                                <div className="text-center py-12 text-muted-foreground italic">No calender entries found.</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>

                {/* Schedule Modal */}
                <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                                {editingScheduleId ? 'Edit Calender Entry' : 'Add Calender Entry'}
                            </DialogTitle>
                            <DialogDescription>Schedule a new activity for the team.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Title *</Label>
                                <Input placeholder="Meeting title..." value={scheduleForm.title} onChange={e => setScheduleForm(prev => ({ ...prev, title: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input placeholder="Brief details..." value={scheduleForm.description} onChange={e => setScheduleForm(prev => ({ ...prev, description: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Time *</Label>
                                    <Input 
                                        type="datetime-local" 
                                        min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                        value={scheduleForm.start_time} 
                                        onChange={e => setScheduleForm(prev => ({ ...prev, start_time: e.target.value }))} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Time *</Label>
                                    <Input 
                                        type="datetime-local" 
                                        min={scheduleForm.start_time || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                        value={scheduleForm.end_time} 
                                        onChange={e => setScheduleForm(prev => ({ ...prev, end_time: e.target.value }))} 
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                            <Button onClick={handleScheduleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary text-white">
                                {isSubmitting ? 'Saving...' : 'Save Entry'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
