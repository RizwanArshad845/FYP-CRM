import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { PlusCircle, ClipboardList, BarChart3, CheckCircle2, Clock, XCircle, AlertCircle, Search, Pencil, Trash2 } from 'lucide-react';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { cls } from '../../styles/classes';
import { useManagerTasks, type TaskPriority, type TaskStatus } from '../../context/ManagerTaskContext';

const PRIORITY_BADGE: Record<TaskPriority, string> = {
    high: 'bg-danger-bg text-danger border-danger-border',
    medium: 'bg-warning-bg text-warning border-warning/30',
    low: 'bg-success-bg text-success border-success/30',
};

const STATUS_BADGE: Record<TaskStatus, string> = {
    completed: 'bg-success-bg text-success border-success/30',
    'in-progress': 'bg-primary-soft text-primary border-primary/30',
    pending: 'bg-muted text-muted-foreground border-border',
    missed: 'bg-danger-bg text-danger border-danger-border',
};

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
    completed: <CheckCircle2 className="h-3.5 w-3.5" />,
    'in-progress': <Clock className="h-3.5 w-3.5" />,
    pending: <AlertCircle className="h-3.5 w-3.5" />,
    missed: <XCircle className="h-3.5 w-3.5" />,
};

const CATEGORIES = ['Management', 'Sales', 'Report', 'HR', 'Admin', 'Coaching', 'Strategy', 'Other'];

const EMPTY_FORM = { title: '', priority: 'medium' as TaskPriority, dueDate: '', category: 'Management', notes: '' };

function completionColor(pct: number) {
    if (pct >= 80) return { text: 'text-success ', bg: 'bg-success-bg border-success/30 ', bar: 'bg-success', label: 'Excellent' };
    if (pct >= 60) return { text: 'text-warning ', bg: 'bg-warning-bg border-warning/30 ', bar: 'bg-warning', label: 'On Track' };
    return { text: 'text-danger ', bg: 'bg-danger-bg border-danger-border ', bar: 'bg-danger', label: 'Needs Improvement' };
}

export function ManagerTaskBoard() {
    const { tasks, addTask, updateTask, updateTaskStatus, deleteTask } = useManagerTasks();
    const [form, setForm] = useState(EMPTY_FORM);
    const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
    const [filterOrigin, setFilterOrigin] = useState<'all' | 'self' | 'admin'>('all');
    const [taskSearch, setTaskSearch] = useState('');
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);

    const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }));

    const handleCreate = () => {
        if (!form.title.trim() || !form.dueDate) {
            toast.error('Please fill in title and due date');
            return;
        }
        addTask({ ...form, status: 'pending', assignedBy: 'self' });
        toast.success('Task created successfully!');
        setForm(EMPTY_FORM);
    };

    const handleEditClick = (task: any) => {
        setEditingTask({
            id: task.id,
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
            category: task.category,
            notes: task.notes,
            status: task.status
        });
        setIsEditDialogOpen(true);
    };

    const handleUpdateTask = (e: React.FormEvent) => {
        e.preventDefault();
        updateTask(editingTask);
        setIsEditDialogOpen(false);
        setEditingTask(null);
    };

    const handleDeleteClick = (id: number) => {
        if (window.confirm('Are you sure you want to delete this task?')) {
            deleteTask(id);
        }
    };

    // ── Month evaluation (current month) ──────────────────────────────────────
    const now = new Date();
    const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const monthTasks = tasks.filter(t => t.month === currentMonthLabel);
    const total = monthTasks.length;
    const completed = monthTasks.filter(t => t.status === 'completed').length;
    const inProgress = monthTasks.filter(t => t.status === 'in-progress').length;
    const missed = monthTasks.filter(t => t.status === 'missed').length;
    const pending = monthTasks.filter(t => t.status === 'pending').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const theme = completionColor(pct);

    // ── Filtered list ─────────────────────────────────────────────────────────
    const filtered = tasks.filter(t => {
        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        if (filterOrigin !== 'all' && t.assignedBy !== filterOrigin) return false;
        if (taskSearch && !t.title.toLowerCase().includes(taskSearch.toLowerCase())) return false;
        return true;
    });

    return (
        <div className={cls.page}>
            {/* ── Month-End Evaluation ────────────────────────────────────── */}
            <Card className={`border-2 ${theme.bg}`}>
                <CardHeader>
                    <CardTitle className={`${cls.inline} ${theme.text}`}>
                        <BarChart3 className="h-5 w-5" />
                        {currentMonthLabel} — Task Evaluation
                    </CardTitle>
                    <CardDescription>Your task completion rate for this month</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                        {/* Big percentage */}
                        <div className={`flex flex-col items-center justify-center w-36 h-36 rounded-full border-4 ${theme.bg} shrink-0 mx-auto md:mx-0 shadow-lg`}
                            style={{ borderColor: 'currentColor' }}>
                            <span className={`text-4xl font-extrabold ${theme.text}`}>{pct}%</span>
                            <span className={`text-xs font-semibold mt-1 opacity-90 ${theme.text}`}>{theme.label}</span>
                        </div>

                        <div className="flex-1 space-y-3 w-full">
                            <Progress value={pct} className="h-3" />
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                                <div className="p-3 bg-card rounded-xl border shadow-sm border-border">
                                    <p className="text-2xl font-bold">{total}</p>
                                    <p className={cls.hintXs}>Total</p>
                                </div>
                                <div className="p-3 bg-card rounded-xl border shadow-sm border-border">
                                    <p className="text-2xl font-bold text-success ">{completed}</p>
                                    <p className={cls.hintXs}>Completed</p>
                                </div>
                                <div className="p-3 bg-card rounded-xl border shadow-sm border-border">
                                    <p className="text-2xl font-bold text-primary ">{inProgress}</p>
                                    <p className={cls.hintXs}>In Progress</p>
                                </div>
                                <div className="p-3 bg-card rounded-xl border shadow-sm border-border">
                                    <p className="text-2xl font-bold text-danger ">{missed}</p>
                                    <p className={cls.hintXs}>Missed</p>
                                </div>
                            </div>
                            <p className={cls.hintXs}>
                                {pending} task{pending !== 1 ? 's' : ''} still pending · 
                                Target: 80% completion to reach <strong className="text-success">Excellent</strong> rating
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Create Task ─────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className={cls.inline}>
                        <PlusCircle className="h-5 w-5" />
                        Create Task
                    </CardTitle>
                    <CardDescription>Add a task to your own board</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className={`${cls.field} lg:col-span-2`}>
                            <Label>Task Title *</Label>
                            <Input
                                placeholder="e.g. Review weekly pipeline"
                                value={form.title}
                                onChange={e => set('title', e.target.value)}
                            />
                        </div>
                        <div className={cls.field}>
                            <Label>Priority</Label>
                            <Select value={form.priority} onValueChange={v => set('priority', v as TaskPriority)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className={cls.field}>
                            <Label>Category</Label>
                            <Select value={form.category} onValueChange={v => set('category', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className={cls.field}>
                            <Label>Due Date *</Label>
                            <Input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
                        </div>
                        <div className={`${cls.field} lg:col-span-3`}>
                            <Label>Notes</Label>
                            <Textarea
                                rows={2}
                                placeholder="Optional notes..."
                                value={form.notes}
                                onChange={e => set('notes', e.target.value)}
                            />
                        </div>
                    </div>
                    <Button className="mt-4" onClick={handleCreate}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Task
                    </Button>
                </CardContent>
            </Card>

            {/* ── Task List ───────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <div className={cls.row}>
                        <div>
                            <CardTitle className={cls.inline}>
                                <ClipboardList className="h-5 w-5" />
                                All Tasks
                            </CardTitle>
                            <CardDescription>Self-assigned and admin-assigned tasks</CardDescription>
                        </div>
                        {/* Filters */}
                        <div className="flex gap-2 flex-wrap">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search tasks..." value={taskSearch} onChange={e => setTaskSearch(e.target.value)} className="pl-9 h-8 text-xs w-[200px]" />
                            </div>
                            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as TaskStatus | 'all')}>
                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="missed">Missed</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterOrigin} onValueChange={v => setFilterOrigin(v as 'all' | 'self' | 'admin')}>
                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sources</SelectItem>
                                    <SelectItem value="self">Self-assigned</SelectItem>
                                    <SelectItem value="admin">Admin-assigned</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filtered.length === 0 ? (
                        <p className={`${cls.hint} text-center py-8`}>No tasks match the current filters.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="w-full text-sm">
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        {['Task', 'Category', 'Priority', 'Due Date', 'Source', 'Status', 'Update Status', 'Actions'].map(h => (
                                            <TableHead key={h} className={cls.tableHead}>{h}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y">
                                    {filtered.map(task => (
                                        <TableRow key={task.id} className={cls.tableRow}>
                                            <TableCell className={`${cls.tableCell} max-w-[220px]`}>
                                                <p className={cls.heading}>{task.title}</p>
                                                {task.notes && <p className={cls.hintXs}>{task.notes}</p>}
                                            </TableCell>
                                            <TableCell className={cls.tableCell}>
                                                <span className={cls.hintXs}>{task.category}</span>
                                            </TableCell>
                                            <TableCell className={cls.tableCell}>
                                                <Badge className={`text-xs border ${PRIORITY_BADGE[task.priority]}`}>
                                                    {task.priority}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={`${cls.tableCell} text-xs font-mono`}>{task.dueDate}</TableCell>
                                            <TableCell className={cls.tableCell}>
                                                <Badge variant="outline" className="text-xs">
                                                    {task.assignedBy === 'admin' ? 'From admin' : 'Self'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={cls.tableCell}>
                                                <Badge className={`${STATUS_BADGE[task.status]} border text-xs flex items-center gap-1 w-fit`}>
                                                    {STATUS_ICON[task.status]}
                                                    {task.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={cls.tableCell}>
                                                <Select
                                                    value={task.status}
                                                    onValueChange={v => {
                                                        updateTaskStatus(task.id, v as TaskStatus);
                                                    }}
                                                >
                                                    <SelectTrigger className="h-7 w-32 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="in-progress">In Progress</SelectItem>
                                                        <SelectItem value="completed">Completed</SelectItem>
                                                        <SelectItem value="missed">Missed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className={cls.tableCell}>
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-7 w-7 text-primary hover:text-primary"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditClick(task);
                                                        }}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-7 w-7 text-danger hover:text-danger"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteClick(task.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
            {/* ── Edit Task Dialog ─────────────────────────────────────────── */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Task</DialogTitle>
                        <DialogDescription>Modify task details below</DialogDescription>
                    </DialogHeader>
                    {editingTask && (
                        <form onSubmit={handleUpdateTask} className="space-y-4">
                            <div className={cls.field}>
                                <Label>Title *</Label>
                                <Input 
                                    value={editingTask.title} 
                                    onChange={e => setEditingTask({...editingTask, title: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className={cls.field}>
                                    <Label>Priority</Label>
                                    <Select value={editingTask.priority} onValueChange={v => setEditingTask({...editingTask, priority: v})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="low">Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className={cls.field}>
                                    <Label>Due Date</Label>
                                    <Input 
                                        type="date" 
                                        value={editingTask.dueDate} 
                                        onChange={e => setEditingTask({...editingTask, dueDate: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className={cls.field}>
                                <Label>Category</Label>
                                <Select value={editingTask.category} onValueChange={v => setEditingTask({...editingTask, category: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className={cls.field}>
                                <Label>Notes</Label>
                                <Textarea 
                                    value={editingTask.notes} 
                                    onChange={e => setEditingTask({...editingTask, notes: e.target.value})}
                                    rows={3}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                                <Button type="submit">Save Changes</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
