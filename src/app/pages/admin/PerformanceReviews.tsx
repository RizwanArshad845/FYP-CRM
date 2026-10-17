import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Download, Search, TrendingUp } from 'lucide-react';
import { cls } from '../../styles/classes';
import { useAttendance } from '../../context/AttendanceContext';
import { usePerformance } from '../../context/PerformanceContext';
import { TASK_STATUSES, TASK_PRIORITIES } from '../../constants/crm';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────


const TASK_STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  missed: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  submitted: 'bg-indigo-100 text-indigo-800'
};

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-orange-50 text-orange-700 border-orange-200',
  low: 'bg-gray-50 text-gray-600 border-gray-200',
};

function statusBadge(status: 'on-time' | 'tardy' | 'absent') {
  if (status === 'on-time') return <Badge className="bg-green-100 text-green-800 border-0">On Time</Badge>;
  if (status === 'tardy') return <Badge className="bg-yellow-100 text-yellow-800 border-0">Tardy</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-0">Absent</Badge>;
}

function exportCSV(name: string, records: any[]) {
  try {
    if (!records || records.length === 0) {
      toast.error('No records available to export');
      return;
    }
    const header = 'Employee,Department,Date,Clock In,Clock Out,Hours Worked,Status\n';
    const rows = records.map(r =>
      `${r.user_name},${r.department},${r.date},${r.clock_in_time ?? '—'},${r.clock_out_time ?? '—'},${r.total_hours ?? '—'},${r.status}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${name.replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Exported ${records.length} records for ${name}`);
  } catch (error) {
    console.error('CSV Export failed:', error);
    toast.error('Failed to generate CSV export');
  }
}

function exportGridCSV(stats: any) {
  try {
    const all = [...(stats?.sales || []), ...(stats?.cst || []), ...(stats?.finance || [])];
    if (all.length === 0) {
      toast.error('No stats data available to export');
      return;
    }
    const header = '#,Employee Name,Role,Daily Attendance %,Weekly Attendance %,Monthly Attendance %\n';
    const rows = all.map((m, idx) =>
      `"${idx + 1}","${m.name}","${m.role}","${m.daily_attendance_score}%","${m.weekly_attendance_score}%","${m.monthly_attendance_score}%"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_summary_grid.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Performance summary exported');
  } catch (error) {
    console.error('Grid CSV Export failed:', error);
    toast.error('Failed to export performance grid');
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={cls.muted}>
      <p className={`${cls.hintXs} mb-1`}>{label}</p>
      <p className={cls.metricSm}>{value}</p>
    </div>
  );
}

function MemberHeader({ name, role }: { name: string; role: string }) {
  return (
    <div className={cls.row}>
      <div><h4 className="text-lg font-semibold">{name}</h4><p className={cls.hint}>{role}</p></div>
    </div>
  );
}

function AttendanceTable({ userId, employeeName }: { userId: number; employeeName: string }) {
  const [showFull, setShowFull] = useState(false);
  const { records, fetchRecords } = useAttendance();
  const empRecords = records.filter(r => r.user_id === userId);
  const onTime = empRecords.filter(r => r.status === 'on-time').length;
  const tardy = empRecords.filter(r => r.status === 'tardy').length;
  const absent = empRecords.filter(r => r.status === 'absent').length;
  const avgHrs = empRecords.length
    ? (empRecords.reduce((s, r) => s + (r.total_hours ?? 0), 0) / empRecords.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Attendance</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(employeeName, empRecords)}>
            <Download className="h-3.5 w-3.5 mr-1" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (!showFull) {
                // Fetch fresh records before showing
                fetchRecords().catch(() => toast.error('Failed to sync recent attendance logs'));
            }
            setShowFull(v => !v);
          }}>
            {showFull ? 'Hide Log' : 'View Full Log'}
          </Button>
        </div>
      </div>

      {/* Summary tiles — always visible */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'On Time', value: onTime, bg: 'bg-green-50 border-green-200', text: 'text-green-700' },
          { label: 'Tardy', value: tardy, bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
          { label: 'Absent', value: absent, bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
          { label: 'Avg Hrs', value: `${avgHrs}h`, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
        ].map(({ label, value, bg, text }) => (
          <div key={label} className={`rounded-lg border ${bg} px-3 py-2 text-center`}>
            <p className={`text-xs font-medium ${text}`}>{label}</p>
            <p className={`text-xl font-bold ${text}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Full table — toggled */}
      {showFull && (
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow>{['Date', 'Clock In', 'Clock Out', 'Hours', 'Status'].map(h => (
                <TableHead key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</TableHead>
              ))}</TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {empRecords.map(r => (
                <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="px-3 py-2 font-mono text-xs">{r.date}</TableCell>
                  <TableCell className="px-3 py-2 font-mono text-xs">{r.clock_in_time ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="px-3 py-2 font-mono text-xs">{r.clock_out_time ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="px-3 py-2 font-mono text-xs">{r.total_hours != null ? `${r.total_hours}h` : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="px-3 py-2">{statusBadge(r.status)}</TableCell>
                </TableRow>
              ))}
              {empRecords.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">No attendance records</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}


function TaskDetailTable({ employeeName, search, filterStatus, filterPriority }: {
  employeeName: string; search: string; filterStatus: string; filterPriority: string;
}) {
  const { taskDetails } = usePerformance();
  const tasks = taskDetails.filter(t => {
    const matchName = t.employee_name === employeeName;
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
    return matchName && matchSearch && matchStatus && matchPriority;
  });

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Task Details</p>
      <div className="overflow-x-auto">
        <Table className="w-full text-sm">
          <TableHeader className="bg-muted/50">
            <TableRow>{['Task', 'Category', 'Priority', 'Status', 'Due Date'].map(h => (
              <TableHead key={h} className={cls.tableHead}>{h}</TableHead>
            ))}</TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {tasks.map(t => (
              <TableRow key={t.id} className={cls.tableRow}>
                <TableCell className={`${cls.tableCell} font-medium max-w-[200px]`}>{t.title}</TableCell>
                <TableCell className={cls.tableCell}><Badge variant="outline" className="text-xs">{t.category}</Badge></TableCell>
                <TableCell className={cls.tableCell}><Badge className={`${PRIORITY_STYLE[t.priority]} border text-xs`}>{t.priority}</Badge></TableCell>
                <TableCell className={cls.tableCell}><Badge className={`${TASK_STATUS_STYLE[t.status]} border-0 text-xs`}>{t.status}</Badge></TableCell>
                <TableCell className={`${cls.tableCell} font-mono text-xs`}>{t.due_date}</TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">No tasks match the current filters</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Search / Filter bar (shared) ─────────────────────────────────────────────
function FilterBar({ search, setSearch, agentSearch, setAgentSearch, filterStatus, setFilterStatus, filterPriority, setFilterPriority }: {
  search: string; setSearch: (v: string) => void;
  agentSearch: string; setAgentSearch: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  filterPriority: string; setFilterPriority: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center mb-6 p-4 rounded-xl bg-muted/30 border border-border/50 shadow-sm">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employee name or role..." value={agentSearch} onChange={e => setAgentSearch(e.target.value)} className="pl-9 h-10 text-sm bg-background" />
      </div>
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search tasks or categories…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 text-sm bg-background" />
      </div>
      <div className="flex gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[145px] h-10 text-sm bg-background"><SelectValue placeholder="Task Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {TASK_STATUSES.map((s: string) => <SelectItem key={s} value={s}>{s.replace('-', ' ').toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px] h-10 text-sm bg-background"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {TASK_PRIORITIES.map((p: string) => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AttendanceGridView({ gridData, agentSearch }: { gridData: any[]; agentSearch: string }) {
    if (!gridData || gridData.length === 0) return <div className="p-8 text-center text-muted-foreground">No attendance data available for the grid.</div>;

    // Group by user
    const userMap: Record<number, any> = {};
    const dates = new Set<string>();

    gridData.forEach(row => {
        const name = `${row.first_name} ${row.last_name}`;
        if (agentSearch && !name.toLowerCase().includes(agentSearch.toLowerCase()) && !row.role.toLowerCase().includes(agentSearch.toLowerCase())) return;

        if (!userMap[row.user_id]) {
            userMap[row.user_id] = {
                id: row.user_id,
                name,
                role: row.role,
                department: row.department,
                days: {}
            };
        }
        if (row.date) {
            const dateStr = new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
            dates.add(dateStr);
            userMap[row.user_id].days[dateStr] = row.attendance_status;
        }
    });

    const sortedDates = Array.from(dates).sort((a, b) => {
        const [da, ma] = a.split('/').map(Number);
        const [db, mb] = b.split('/').map(Number);
        return ma === mb ? da - db : ma - mb;
    });

    const users = Object.values(userMap).sort((a: any, b: any) => a.department.localeCompare(b.department));

    if (users.length === 0) return <div className="p-8 text-center text-muted-foreground">No employees match your search.</div>;

    return (
        <div className="overflow-x-auto max-h-[600px]">
            <Table className="w-full text-[10px] border-collapse sticky-header">
                <TableHeader className="bg-muted/80 backdrop-blur sticky top-0 z-10 border-b border-border/50">
                    <TableRow>
                        <TableHead className="px-3 py-2 text-left font-bold text-muted-foreground uppercase tracking-wider border-r bg-muted/90 min-w-[150px] sticky left-0 z-20">Employee</TableHead>
                        <TableHead className="px-3 py-2 text-left font-bold text-muted-foreground uppercase tracking-wider border-r min-w-[100px]">Role</TableHead>
                        {sortedDates.map(date => (
                            <TableHead key={date} className="px-2 py-2 text-center font-bold text-muted-foreground uppercase tracking-wider border-r min-w-[50px]">{date}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/40">
                    {users.map((u: any, i: number) => (
                        <TableRow key={u.id} className={`hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
                            <TableCell className="px-3 py-2 font-medium text-foreground border-r bg-background/50 sticky left-0 z-10">{u.name}</TableCell>
                            <TableCell className="px-3 py-2 text-muted-foreground border-r">{u.role.replace('_', ' ')}</TableCell>
                            {sortedDates.map(date => {
                                const status = u.days[date];
                                let color = 'bg-gray-100 text-gray-400';
                                if (status === 'on-time') color = 'bg-green-100 text-green-700';
                                else if (status === 'tardy') color = 'bg-yellow-100 text-yellow-700';
                                else if (status === 'absent') color = 'bg-red-100 text-red-700';
                                
                                return (
                                    <TableCell key={date} className="px-1 py-1 text-center border-r">
                                        {status ? (
                                            <div className={`rounded-sm py-0.5 font-bold uppercase text-[8px] ${color}`}>
                                                {status === 'on-time' ? 'ON' : (status === 'tardy' ? 'TA' : 'AB')}
                                            </div>
                                        ) : (
                                            <span className="text-gray-200">—</span>
                                        )}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function MasterGridView({ stats, agentSearch }: { stats: any; agentSearch: string }) {
  const all = [
    ...(stats?.sales || []).map((s: any) => ({ ...s, dept: 'Sales' })),
    ...(stats?.cst || []).map((s: any) => ({ ...s, dept: 'CST' })),
    ...(stats?.finance || []).map((s: any) => ({ ...s, dept: 'Finance' }))
  ].filter(m => {
    if (!agentSearch) return true;
    return m.name.toLowerCase().includes(agentSearch.toLowerCase()) || m.role.toLowerCase().includes(agentSearch.toLowerCase());
  });

  return (
    <div className="space-y-8">
        <div className="overflow-x-auto">
        <Table className="w-full text-sm border-collapse">
            <TableHeader className="bg-muted/50 border-b border-border/50">
            <TableRow>
                {['#', 'Employee', 'Department', 'Role', 'Daily Att %', 'Weekly Att %', 'Monthly Att %', 'Revenue / Clients', 'Performance'].map(h => (
                <TableHead key={h} className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">{h}</TableHead>
                ))}
            </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
            {all.map((m, i) => {
                const target = m.target_revenue || 1;
                const progress = Math.min(100, Math.round(((m.monthly_revenue || 0) / target) * 100));
                
                return (
                    <TableRow key={`${m.id}-${m.dept}`} className={`hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
                    <TableCell className="px-4 py-3 text-muted-foreground font-mono text-[10px]">{i + 1}</TableCell>
                    <TableCell className="px-4 py-3 font-medium text-foreground">{m.name}</TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">{m.dept}</TableCell>
                    <TableCell className="px-4 py-3"><Badge variant="outline" className="text-[10px] font-normal">{m.role}</Badge></TableCell>
                    <TableCell className="px-4 py-3 font-mono text-xs">{m.daily_attendance_score}%</TableCell>
                    <TableCell className="px-4 py-3 font-mono text-xs">{m.weekly_attendance_score}%</TableCell>
                    <TableCell className="px-4 py-3 font-mono text-xs">{m.monthly_attendance_score}%</TableCell>
                    <TableCell className="px-4 py-3 font-medium">
                        {m.dept === 'Sales' ? `$${(m.monthly_revenue || 0).toLocaleString()}` : (m.dept === 'CST' ? `${m.clients_managed} Clients` : '—')}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2">
                        <Progress value={m.dept === 'Sales' ? progress : 85} className="h-1.5 w-16" />
                        <span className="text-[10px] font-bold text-muted-foreground">
                            {m.dept === 'Sales' ? `${progress}%` : 'Good'}
                        </span>
                        </div>
                    </TableCell>
                    </TableRow>
                );
            })}
            {all.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No employees found matching your search</TableCell></TableRow>
            )}
            </TableBody>
        </Table>
        </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PerformanceReviews() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [agentSearch, setAgentSearch] = useState('');

  const { stats, taskDetails, attendanceGrid, isLoading } = usePerformance();

  const filterProps = { search, setSearch, agentSearch, setAgentSearch, filterStatus, setFilterStatus, filterPriority, setFilterPriority };

  const matchingEmployees = new Set(
    taskDetails.filter(t => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || t.status === filterStatus;
      const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
      return matchSearch && matchStatus && matchPriority;
    }).map(t => t.employee_name)
  );

  const filterTeam = <T extends { name: string, role?: string }>(team: T[] | undefined) =>
    (team || []).filter(m => {
        const matchesAgent = !agentSearch || m.name.toLowerCase().includes(agentSearch.toLowerCase()) || (m.role && m.role.toLowerCase().includes(agentSearch.toLowerCase()));
        const matchesTasks = !search && filterStatus === 'all' && filterPriority === 'all' 
            ? true 
            : matchingEmployees.has(m.name);
        return matchesAgent && (matchesTasks || !taskDetails.some(td => td.employee_name === m.name)); // Show employees without tasks anyway unless searching specifically for tasks
    });

  if (isLoading) return <div className="p-8 text-center">Loading performance data...</div>;

  const salesManagers = (stats?.sales || []).filter(s => s.role === 'sales_manager');
  const salesAgents = (stats?.sales || []).filter(s => s.role === 'sales');

  return (
    <Card>
      <CardHeader>
        <div className={cls.row}>
          <div>
            <CardTitle>Performance Reviews by Team</CardTitle>
            <CardDescription>Comprehensive performance metrics, task details, and full attendance records</CardDescription>
          </div>
          <div className="flex gap-3 items-center">
            <Button variant="outline" onClick={() => exportGridCSV(stats)}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-muted/30 p-1">
            <TabsTrigger value="sales">Sales Agents</TabsTrigger>
            <TabsTrigger value="sales_manager">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />Sales Managers
            </TabsTrigger>
            <TabsTrigger value="cst">CST Team</TabsTrigger>
            <TabsTrigger value="finance">Finance Team</TabsTrigger>
            <TabsTrigger value="grid">
              Master Grid
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <FilterBar {...filterProps} />
          </div>

          {/* Sales Agents */}
          <TabsContent value="sales" className={cls.section}>
            {filterTeam(salesAgents).map(m => (
              <Card key={m.id} className="border-2">
                <CardHeader><MemberHeader name={m.name} role={m.role} /></CardHeader>
                <CardContent className={cls.section}>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-4">
                    <StatTile label="Revenue" value={`$ ${m.monthly_revenue.toLocaleString()}`} />
                    <StatTile label="Calls Made" value={m.calls_made} />
                    <StatTile label="Deals Closed" value={m.deals_closed} />
                    <StatTile label="Target" value={`$ ${m.target_revenue.toLocaleString()}`} />
                    <StatTile label="Daily Att %" value={`${m.daily_attendance_score}%`} />
                    <StatTile label="Weekly Att %" value={`${m.weekly_attendance_score}%`} />
                    <StatTile label="Monthly Att %" value={`${m.monthly_attendance_score}%`} />
                  </div>
                  <div>
                    <div className={`${cls.row} text-sm mb-2`}>
                      <span className={cls.label}>Revenue Progress</span>
                      <span className={cls.hint}>{Math.round(((m.monthly_revenue || 0) / (m.target_revenue || 1)) * 100)}%</span>
                    </div>
                    <Progress value={((m.monthly_revenue || 0) / (m.target_revenue || 1)) * 100} />
                  </div>
                  <TaskDetailTable employeeName={m.name} search={search} filterStatus={filterStatus} filterPriority={filterPriority} />
                  <AttendanceTable userId={m.id} employeeName={m.name} />
                </CardContent>
              </Card>
            ))}
            {filterTeam(salesAgents).length === 0 && <p className="text-center py-8 text-muted-foreground">No agents found</p>}
          </TabsContent>

          {/* Sales Manager */}
          <TabsContent value="sales_manager" className={cls.section}>
            {filterTeam(salesManagers).map(m => (
              <Card key={m.id} className="border-2 border-blue-200">
                <CardHeader><MemberHeader name={m.name} role={m.role} /></CardHeader>
                <CardContent className={cls.section}>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                    <StatTile label="Total Revenue" value={`$ ${m.monthly_revenue.toLocaleString()}`} />
                    <StatTile label="Tasks Done" value={m.tasks_completed} />
                    <StatTile label="Tasks Missed" value={m.tasks_missed} />
                    <StatTile label="Daily Att %" value={`${m.daily_attendance_score}%`} />
                    <StatTile label="Weekly Att %" value={`${m.weekly_attendance_score}%`} />
                    <StatTile label="Monthly Att %" value={`${m.monthly_attendance_score}%`} />
                  </div>
                  <div>
                    <div className={`${cls.row} text-sm mb-2`}>
                      <span className={cls.label}>Revenue Progress</span>
                      <span className={cls.hint}>{Math.round(((m.monthly_revenue || 0) / (m.target_revenue || 1)) * 100)}%</span>
                    </div>
                    <Progress value={((m.monthly_revenue || 0) / (m.target_revenue || 1)) * 100} />
                  </div>
                  <TaskDetailTable employeeName={m.name} search={search} filterStatus={filterStatus} filterPriority={filterPriority} />
                  <AttendanceTable userId={m.id} employeeName={m.name} />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* CST */}
          <TabsContent value="cst" className={cls.section}>
            {filterTeam(stats.cst).map(m => (
              <Card key={m.id} className="border-2">
                <CardHeader><MemberHeader name={m.name} role={m.role} /></CardHeader>
                <CardContent className={cls.section}>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-4">
                    <StatTile label="Clients" value={m.clients_managed} />
                    <StatTile label="Tasks Done" value={m.tasks_completed} />
                    <StatTile label="Tasks Missed" value={m.tasks_missed} />
                    <StatTile label="Client Rating" value={`${m.satisfaction_score} / 5`} />
                    <StatTile label="Daily Att %" value={`${m.daily_attendance_score}%`} />
                    <StatTile label="Weekly Att %" value={`${m.weekly_attendance_score}%`} />
                    <StatTile label="Monthly Att %" value={`${m.monthly_attendance_score}%`} />
                  </div>
                  <TaskDetailTable employeeName={m.name} search={search} filterStatus={filterStatus} filterPriority={filterPriority} />
                  <AttendanceTable userId={m.id} employeeName={m.name} />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Finance */}
          <TabsContent value="finance" className={cls.section}>
            {filterTeam(stats.finance).map(m => (
              <Card key={m.id} className="border-2">
                <CardHeader><MemberHeader name={m.name} role={m.role} /></CardHeader>
                <CardContent className={cls.section}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <StatTile label="Payments Processed" value={m.payments_processed} />
                    <StatTile label="Daily Att %" value={`${m.daily_attendance_score}%`} />
                    <StatTile label="Weekly Att %" value={`${m.weekly_attendance_score}%`} />
                    <StatTile label="Monthly Att %" value={`${m.monthly_attendance_score}%`} />
                  </div>
                  <AttendanceTable userId={m.id} employeeName={m.name} />
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="grid" className={cls.section}>
            <div className="space-y-10">
                <section>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Employee Performance Summary</h3>
                    <MasterGridView stats={stats} agentSearch={agentSearch} />
                </section>
                <section>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Detailed Attendance Grid (30 Days)</h3>
                    <AttendanceGridView gridData={attendanceGrid} agentSearch={agentSearch} />
                </section>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
