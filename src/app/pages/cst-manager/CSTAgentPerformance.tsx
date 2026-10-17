import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { TrendingUp, Mic, Search, Loader2, Edit, Trash2, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { cls } from '../../styles/classes';
import { apiFetch } from '../../utils/api';
import { toast } from 'sonner';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { useClientInbox } from '../../context/ClientInboxContext';

interface AgentPerformanceMetrics {
    target_id: number;
    agent_id: number;
    first_name: string;
    last_name: string;
    user_status: string;
    target_month: string;
    total_target: number;
    total_achieved: number;
    recording_count: number;
    attendance_pct: number;
}

function formatCurrency(amount: number) {
    return `$ ${(amount || 0).toLocaleString()}`;
}

function calcPercentage(achieved: number, target: number) {
    if (!target) return 0;
    return Math.round((achieved / target) * 100);
}

function percentageColor(pct: number) {
    if (pct >= 100) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (pct >= 75) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
}

export function CSTAgentPerformance() {
    const { deleteTarget } = useClientInbox();
    const [agents, setAgents] = useState<AgentPerformanceMetrics[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortBy, setSortBy] = useState('performance');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterMonth, setFilterMonth] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingMetric, setEditingMetric] = useState<AgentPerformanceMetrics | null>(null);
    const [newTargetAmount, setNewTargetAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/cst-manager/agent-performance');
            if (res.success && Array.isArray(res.data)) {
                setAgents(res.data.map((a: any) => ({
                    ...a,
                    total_target: Number(a.total_target),
                    total_achieved: Number(a.total_achieved),
                    recording_count: Number(a.recording_count),
                    attendance_pct: Number(a.attendance_pct)
                })));
            }
        } catch (error) {
            toast.error('Failed to load performance metrics');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const formatTargetMonth = (dateStr: string) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr.length === 7 ? `${dateStr}-01` : dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    const uniqueMonths = Array.from(new Set(agents.map(a => a.target_month))).sort().reverse();

    let list = [...agents];
    if (filterStatus !== 'all') {
        const fs = filterStatus.toLowerCase();
        list = list.filter(a => (a.user_status || '').toLowerCase() === fs);
    }
    if (filterMonth !== 'all') {
        list = list.filter(a => a.target_month === filterMonth);
    }
    if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        list = list.filter(a => 
            a.first_name.toLowerCase().includes(q) || 
            a.last_name.toLowerCase().includes(q)
        );
    }
    
    if (sortBy === 'performance') list.sort((a, b) => calcPercentage(b.total_achieved, b.total_target) - calcPercentage(a.total_achieved, a.total_target));
    else if (sortBy === 'achieved') list.sort((a, b) => b.total_achieved - a.total_achieved);
    else if (sortBy === 'recordings') list.sort((a, b) => b.recording_count - a.recording_count);
    else if (sortBy === 'attendance') list.sort((a, b) => b.attendance_pct - a.attendance_pct);

    const handleEditClick = (metric: AgentPerformanceMetrics) => {
        setEditingMetric(metric);
        setNewTargetAmount(metric.total_target.toString());
        setIsEditDialogOpen(true);
    };

    const handleUpdateTarget = async () => {
        if (!editingMetric || !newTargetAmount) return;
        setIsSubmitting(true);
        try {
            const res = await apiFetch(`/cst-manager/targets/${editingMetric.target_id}`, {
                method: 'PUT',
                body: JSON.stringify({ target_amount: Number(newTargetAmount) })
            });
            if (res.success) {
                toast.success('Target amount updated');
                setIsEditDialogOpen(false);
                setEditingMetric(null);
                fetchData();
            } else {
                toast.error('Failed to update target');
            }
        } catch (error) {
            toast.error('Failed to update target');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTarget = async (id: number) => {
        if (!confirm('Are you sure you want to delete this target entry?')) return;
        await deleteTarget(id);
        fetchData(); // Refresh local metrics list
    };

    return (
        <div className={cls.page}>
            <Card>
                <CardHeader>
                    <div className={cls.row}>
                        <div>
                            <CardTitle>CST Team Performance ({list.length} agents visible / {agents.length} total)</CardTitle>
                            <CardDescription>Automated performance tracking based on achieved targets and recording logs</CardDescription>
                        </div>
                        <div className={cls.actions}>
                            <Button variant="outline" size="sm" onClick={() => fetchData()}>
                                <TrendingUp className="h-4 w-4 mr-2" />Refresh Stats
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="relative mt-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search agents..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                className="pl-10" 
                            />
                        </div>
                        <div className="flex-1">
                            <label className={`${cls.label} mb-2 block`}>Filter by Month</label>
                            <Select value={filterMonth} onValueChange={setFilterMonth}>
                                <SelectTrigger><SelectValue placeholder="All Months" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Months</SelectItem>
                                    {uniqueMonths.map(m => (
                                        <SelectItem key={m} value={m}>{formatTargetMonth(m)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <label className={`${cls.label} mb-2 block`}>Sort By</label>
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="performance">Goal Completion %</SelectItem>
                                    <SelectItem value="achieved">Amount Achieved</SelectItem>
                                    <SelectItem value="recordings">Recordings Uploaded</SelectItem>
                                    <SelectItem value="attendance">Attendance %</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <label className={`${cls.label} mb-2 block`}>Filter by Status</label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Agents</SelectItem>
                                    <SelectItem value="active">Active Only</SelectItem>
                                    <SelectItem value="deactivated">Deactivated</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {isLoading ? (
                        <LoadingScreen fullScreen={false} message="Compiling CST Metrics..." />
                    ) : list.length === 0 ? (
                        <div className="text-center py-20">
                            <p className={cls.hint}>No CST performance data found.</p>
                        </div>
                    ) : (
                        <>
                            <div className="hidden lg:block overflow-x-auto">
                                <Table className="w-full">
                                    <TableHeader className="border-b-2">
                                        <TableRow>
                                            {['Agent Name', 'Month', 'Status', 'Targets', 'Achieved', 'Goal %', 'Attendance %', 'Recordings', 'Actions'].map(h => (
                                                <TableHead key={h} className={cls.tableHead}>{h}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {list.map(agent => {
                                            const pct = calcPercentage(agent.total_achieved, agent.total_target);
                                            return (
                                                <TableRow key={agent.agent_id} className={cls.tableRow}>
                                                    <TableCell className={cls.tableCell}>
                                                        <div className={cls.inline}>
                                                            <div className={cls.avatar}>
                                                                <span className={cls.avatarText}>{agent.first_name[0]}{agent.last_name[0]}</span>
                                                            </div>
                                                            <span className={cls.heading}>{agent.first_name} {agent.last_name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={cls.tableCell}>
                                                        <span className="font-medium">{formatTargetMonth(agent.target_month)}</span>
                                                    </TableCell>
                                                    <TableCell className={cls.tableCell}>
                                                        <Badge variant={agent.user_status === 'active' ? 'default' : 'secondary'}>
                                                            {agent.user_status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className={`${cls.tableCell} font-medium`}>{formatCurrency(agent.total_target)}</TableCell>
                                                    <TableCell className={cls.tableCell}>{formatCurrency(agent.total_achieved)}</TableCell>
                                                    <TableCell className={cls.tableCell}>
                                                        <div className={`px-2 py-1 rounded-md inline-flex font-bold text-sm items-center ${percentageColor(pct)}`}>
                                                            <TrendingUp className="w-3.5 h-3.5 mr-1" />
                                                            {pct}%
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={cls.tableCell}>
                                                        <div className={`px-2 py-1 rounded-md inline-flex font-bold text-sm items-center ${percentageColor(agent.attendance_pct)}`}>
                                                            {agent.attendance_pct}%
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={cls.tableCell}>
                                                        <div className={cls.inline}>
                                                            <Mic className="h-4 w-4 text-muted-foreground mr-1" />
                                                            <span className={cls.heading}>{agent.recording_count}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={cls.tableCell}>
                                                        <div className={cls.inline}>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEditClick(agent)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteTarget(agent.target_id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="lg:hidden space-y-4">
                                {list.map(agent => {
                                    const pct = calcPercentage(agent.total_achieved, agent.total_target);
                                    return (
                                        <Card key={agent.agent_id}>
                                            <CardHeader className="pb-2">
                                                <div className={cls.row}>
                                                    <div className={cls.inline}>
                                                        <div className={cls.avatar}>
                                                            <span className={cls.avatarText}>{agent.first_name[0]}{agent.last_name[0]}</span>
                                                        </div>
                                                        <div>
                                                            <h4 className={cls.heading}>{agent.first_name} {agent.last_name}</h4>
                                                            <div className="flex gap-2 items-center mt-1">
                                                                <Badge variant={agent.user_status === 'active' ? 'default' : 'secondary'}>{agent.user_status}</Badge>
                                                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">{formatTargetMonth(agent.target_month)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditClick(agent)}>
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="outline" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteTarget(agent.target_id)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <div className={`px-2 py-1 rounded-md font-bold text-sm ${percentageColor(pct)}`}>
                                                            {pct}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className={cls.grid2}>
                                                    <div>
                                                        <p className={`${cls.hint} mb-1`}>Targets</p>
                                                        <p className={cls.heading}>{formatCurrency(agent.total_target)}</p>
                                                    </div>
                                                    <div>
                                                        <p className={`${cls.hint} mb-1`}>Achieved</p>
                                                        <p className={cls.heading}>{formatCurrency(agent.total_achieved)}</p>
                                                    </div>
                                                    <div>
                                                        <p className={`${cls.hint} mb-1`}>Attendance</p>
                                                        <div className={`px-2 py-0.5 rounded-md font-bold text-sm inline-flex ${percentageColor(agent.attendance_pct)}`}>
                                                            {agent.attendance_pct}%
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 mt-2">
                                                        <div className={cls.inline}>
                                                            <Mic className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm font-medium">{agent.recording_count} uploads logged</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Monthly Target</DialogTitle>
                        <DialogDescription>
                            Updating target for {editingMetric?.first_name} {editingMetric?.last_name} ({formatTargetMonth(editingMetric?.target_month || '')})
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className={cls.field}>
                            <Label>New Target Amount ($)</Label>
                            <Input 
                                type="number" 
                                value={newTargetAmount} 
                                onChange={e => setNewTargetAmount(e.target.value)}
                                placeholder="Enter amount..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleUpdateTarget} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Update Target
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
