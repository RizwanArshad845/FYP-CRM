import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Calendar, FileText, Users, TrendingUp, UserCog, Target, ClipboardList, Globe, Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { WelcomeHero } from '../../components/shared/WelcomeHero';
import { StatCard } from '../../components/shared/StatCard';
import { cls } from '../../styles/classes';
import { EmployeeManagement } from './EmployeeManagement';
import { PerformanceReviews } from './PerformanceReviews';
import { TaskDelegation } from './TaskDelegation';
import { ConcernsPanel } from './ConcernsPanel';
import { usePerformance } from '../../context/PerformanceContext';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { eventsApi } from '../../utils/api';
import { OrganizationSettings } from './OrganizationSettings';
import { useClients } from '../../context/ClientContext';
import { EVENT_TYPES } from '../../constants/crm';
import { toast } from 'sonner';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { getPortalTheme } from '../../styles/portal-themes';
import { useSearchParams } from 'react-router';
import { useConcerns } from '../../context/ConcernContext';

const MANAGER_PERFORMANCE: any[] = [];
const MANAGER_TASK_METRICS: any[] = [];
const ONBOARDING_CLIENTS: any[] = [];

const theme = getPortalTheme('admin');

const STRATEGY_ITEMS = [
  { color: 'bg-green-500', text: 'Increase customer retention by 15%' },
  { color: 'bg-blue-500', text: 'Improve CST response time' },
  { color: 'bg-purple-500', text: 'Launch new training program' },
];

function perfColor(pct: number) {
  if (pct >= 90) return 'text-green-600';
  if (pct >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

const EVENT_COLORS: Record<string, string> = {
  meeting: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  training: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  deadline: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300',
  celebration: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

function healthColor(score: number) {
  if (score >= 85) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

// Active Clients tab — admin view-only
function ActiveClientsPanel() {
  const { clients } = useClients();
  const onboardingClients = clients.filter(c => c.status === 'onboarding');

  return (
    <div className={cls.page}>
      <Card>
        <CardHeader>
          <CardTitle className={cls.inline}><Globe className="h-5 w-5" />Active Clients</CardTitle>
          <CardDescription>View client active/inactive status across all departments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="w-full text-sm">
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  {['Client', 'Assigned Agent', 'Status'].map(h => (
                    <TableHead key={h} className={cls.tableHead}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {clients.map((c, i) => (
                  <TableRow key={c.id} className={`${cls.tableRow} ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <TableCell className={`${cls.tableCell} ${cls.heading}`}>{c.company_name}</TableCell>
                    <TableCell className={cls.tableCell}>{c.assigned_name || '—'}</TableCell>
                    <TableCell className={cls.tableCell}>
                      <Badge variant={c.is_active ? 'default' : 'secondary'}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No clients found in database</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding Clients</CardTitle>
          <CardDescription>Clients currently being onboarded by CST</CardDescription>
        </CardHeader>
        <CardContent className={cls.section}>
          {onboardingClients.map(c => (
            <div key={c.id} className={`${cls.item} ${cls.itemHover}`}>
              <div className={cls.row}>
                <div>
                  <h4 className={cls.heading}>{c.company_name}</h4>
                  <p className={cls.hint}>Agent: {c.assigned_name || 'Unassigned'} · Stage: {c.stage || 'Initial'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{c.onboarding_progress ?? 0}%</p>
                </div>
              </div>
              <Progress value={c.onboarding_progress ?? 0} className="h-2 mt-2" />
            </div>
          ))}
          {onboardingClients.length === 0 && (
            <p className="text-center py-4 text-muted-foreground">No clients currently in onboarding</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const { companyMetrics, isLoading: perfLoading } = usePerformance();
  const { clients } = useClients();
  const { externalConcerns, internalConcerns } = useConcerns();
  const [searchParams] = useSearchParams();
  const activeModule = searchParams.get('module') || 'employees';

  const pendingConcernsCount = [...externalConcerns, ...internalConcerns].filter(c => c.status === 'pending' || c.status === 'open').length;

  const [events, setEvents] = useState<any[]>([]);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', type: 'meeting', created_by_user_id: 1 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', date: '', type: 'meeting' });

  const COMPANY_METRICS: any = companyMetrics ? {
    activeClients: companyMetrics.active_clients,
    totalRevenue: companyMetrics.total_revenue,
    totalEmployees: companyMetrics.total_employees,
    revenueTarget: companyMetrics.revenue_target || 300000,
    clientRetention: companyMetrics.client_retention || 0
  } : { activeClients: 0, totalRevenue: 0, totalEmployees: 0, revenueTarget: 300000, clientRetention: 0 };

  const revenuePct = Math.round(((COMPANY_METRICS.totalRevenue ?? 0) / (COMPANY_METRICS.revenueTarget || 1)) * 100) || 0;
  const UPCOMING_EVENTS = events || [];

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await eventsApi.getAll();
      setEvents(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) {
      toast.error('Event title and date are required');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (newEvent.date < today) {
      toast.error('Cannot create events in the past');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await eventsApi.create(newEvent);
      if (res.success) {
        setIsAddingEvent(false);
        setNewEvent({ title: '', date: '', type: 'meeting', created_by_user_id: 1 });
        fetchEvents();
        toast.success('Event created successfully');
      } else {
        toast.error(res.error || 'Failed to create event');
      }
    } catch (err: any) {
      console.error("Failed to create event", err);
      toast.error(err.message || 'Connection error while creating event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (ev: any) => {
    setEditingEventId(ev.id);
    setEditForm({
      title: ev.title,
      date: ev.date.split('T')[0],
      type: ev.type
    });
  };

  const handleUpdateEvent = async () => {
    if (!editingEventId) return;
    if (!editForm.title || !editForm.date) {
      toast.error('Title and Date are required');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (editForm.date < today) {
      toast.error('Cannot update event to a past date');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await eventsApi.update(editingEventId, editForm);
      if (res.success) {
        setEditingEventId(null);
        fetchEvents();
        toast.success('Event updated successfully');
      } else {
        toast.error(res.error || 'Failed to update event');
      }
    } catch (err: any) {
      console.error("Failed to update event", err);
      toast.error(err.message || 'Connection error while updating event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await eventsApi.delete(id);
      fetchEvents();
      toast.success('Event deleted');
    } catch (err) {
      console.error("Failed to delete event", err);
      toast.error('Failed to delete event');
    }
  };

  if (perfLoading) return <LoadingScreen message="Reaching Admin Hub..." />;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Admin Portal" theme={theme} />
      <main className="container mx-auto px-4 py-8">
        <div className="w-full">

          {activeModule === 'overview' && (
            <div className="animate-fade-in space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                  icon={<TrendingUp className="h-5 w-5 text-indigo-500" />}
                  title="Monthly Revenue"
                  value={`$${(COMPANY_METRICS.totalRevenue ?? 0).toLocaleString()}`}
                  subtitle={`${revenuePct}% of $${(COMPANY_METRICS.revenueTarget ?? 0).toLocaleString()} target`}
                  accentColor={theme.accent}
                  trend={{ value: 12 }}
                />
                <StatCard
                  icon={<Users className="h-5 w-5 text-blue-500" />}
                  title="Active Clients"
                  value={COMPANY_METRICS.activeClients}
                  subtitle={`${COMPANY_METRICS.clientRetention}% retention rate`}
                  accentColor={theme.accent}
                  trend={{ value: 5 }}
                />
              </div>

              <div className="grid grid-cols-1 gap-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className={cls.inline}><Calendar className="h-5 w-5" />Upcoming Events</CardTitle>
                    <CardDescription>Next 7 days</CardDescription>
                  </CardHeader>
                  <CardContent className={cls.section}>
                    {UPCOMING_EVENTS.slice(0, 4).map(ev => (
                      <div key={ev.id} className={`${cls.row} ${cls.itemHover}`}>
                        <div>
                          <h4 className={cls.heading}>{ev.title}</h4>
                          <p className={cls.hint}>{new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <Badge className={EVENT_COLORS[ev.type] ?? EVENT_COLORS.other}>{ev.type}</Badge>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full">View All Events</Button>
                  </CardContent>
                </Card>

              </div>
            </div>
          )}

          {activeModule === 'employees' && <div className="animate-in fade-in slide-in-from-right-4 duration-300"><EmployeeManagement /></div>}
          {activeModule === 'performance' && <div className="animate-in fade-in slide-in-from-right-4 duration-300"><PerformanceReviews /></div>}
          {activeModule === 'tasks' && <div className="animate-in fade-in slide-in-from-right-4 duration-300"><TaskDelegation /></div>}
          {activeModule === 'clients' && <div className="animate-in fade-in slide-in-from-right-4 duration-300"><ActiveClientsPanel /></div>}
          {activeModule === 'org-settings' && <div className="animate-in fade-in slide-in-from-right-4 duration-300"><OrganizationSettings /></div>}
          {activeModule === 'concerns' && <div className={`${cls.page} animate-in fade-in slide-in-from-right-4 duration-300`}><ConcernsPanel /></div>}

          {activeModule === 'events' && (
            <div className={`${cls.page} animate-in fade-in slide-in-from-right-4 duration-300`}>
              <Card className="shadow-sm">
                <CardHeader>
                  <div className={cls.row}>
                    <div>
                      <CardTitle>Event Calendar</CardTitle>
                      <CardDescription>Manage company events and important dates</CardDescription>
                    </div>
                    {!isAddingEvent && (
                      <Button size="sm" onClick={() => setIsAddingEvent(true)}>
                        <Plus className="h-4 w-4 mr-2" />Add Event
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className={cls.section}>
                  {events.map(ev => (
                    <div key={ev.id} className={`${cls.item} border-l-4 ${ev.id === editingEventId ? 'border-blue-500' : 'border-slate-200'}`}>
                      {editingEventId === ev.id ? (
                        <div className="space-y-3 p-2">
                          <div className={cls.grid2}>
                            <div className={cls.field}>
                              <Label className="text-xs">Title</Label>
                              <Input size={1} value={editForm.title} onChange={(e: any) => setEditForm({ ...editForm, title: e.target.value })} />
                            </div>
                            <div className={cls.field}>
                              <Label className="text-xs">Date</Label>
                              <Input
                                type="date"
                                value={editForm.date}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e: any) => setEditForm({ ...editForm, date: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className={cls.field}>
                            <Label className="text-xs">Category</Label>
                            <Select value={editForm.type} onValueChange={(v: string) => setEditForm({ ...editForm, type: v })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" onClick={handleUpdateEvent} disabled={isSubmitting}>
                              {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingEventId(null)} disabled={isSubmitting}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className={cls.row}>
                          <div>
                            <h4 className={cls.heading}>{ev.title}</h4>
                            <p className={cls.hint}>{new Date(ev.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            <Badge className={`${EVENT_COLORS[ev.type] ?? EVENT_COLORS.other} mt-1`}>{ev.type}</Badge>
                          </div>
                          <div className={cls.actions}>
                            <Button variant="outline" size="sm" onClick={() => handleStartEdit(ev)}>
                              <Edit className="h-3.5 w-3.5 mr-1" />Edit
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200" onClick={() => handleDeleteEvent(ev.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isAddingEvent && (
                    <div className="border-2 border-dashed rounded-lg p-6 bg-muted/20 space-y-4 mt-6">
                      <h4 className="font-semibold text-lg">Create New Event</h4>
                      <div className={cls.grid2}>
                        <div className={cls.field}>
                          <Label>Event Title</Label>
                          <Input placeholder="E.g. Strategy Meeting" value={newEvent.title} onChange={(e: any) => setNewEvent({ ...newEvent, title: e.target.value })} />
                        </div>
                        <div className={cls.field}>
                          <Label>Event Date</Label>
                          <Input
                            type="date"
                            value={newEvent.date}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e: any) => setNewEvent({ ...newEvent, date: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className={cls.field}>
                        <Label>Category</Label>
                        <Select value={newEvent.type} onValueChange={(v: string) => setNewEvent({ ...newEvent, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button onClick={handleCreateEvent} disabled={isSubmitting}>
                          {isSubmitting ? 'Creating...' : 'Create Event'}
                        </Button>
                        <Button variant="outline" onClick={() => setIsAddingEvent(false)} disabled={isSubmitting}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {!isAddingEvent && events.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg mt-6">
                      <Calendar className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-3" />
                      <p className="text-muted-foreground">No events scheduled. Click "Add Event" to start.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
