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
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
};

const STATUS_BADGE: Record<TaskStatus, string> = {
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'in-progress': 'bg-blue-100 text-blue-700 border-blue-200',
    pending: 'bg-slate-100 text-slate-600 border-slate-200',
    missed: 'bg-red-100 text-red-700 border-red-200',
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
    if (pct >= 80) return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800', bar: 'bg-emerald-500', label: 'Excellent' };
    if (pct >= 60) return { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800', bar: 'bg-yellow-500', label: 'On Track' };
    return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800', bar: 'bg-red-500', label: 'Needs Improvement' };
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
    const total      = monthTasks.length;
    const completed  = monthTasks.filter(t => t.status === 'completed').length;
    const inProgress = monthTasks.filter(t => t.status === 'in-progress').length;
    const missed     = monthTasks.filter(t => t.status === 'missed').length;
    const pending    = monthTasks.filter(t => t.status === 'pending').length;
    const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;
    const theme      = completionColor(pct);

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
                                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completed}</p>
                                    <p className={cls.hintXs}>Completed</p>
                                </div>
                                <div className="p-3 bg-card rounded-xl border shadow-sm border-border">
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{inProgress}</p>
                                    <p className={cls.hintXs}>In Progress</p>
                                </div>
                                <div className="p-3 bg-card rounded-xl border shadow-sm border-border">
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{missed}</p>
                                    <p className={cls.hintXs}>Missed</p>
                                </div>
                            </div>
                            <p className={cls.hintXs}>
                                {pending} task{pending !== 1 ? 's' : ''} still pending · 
                                Target: 80% completion to reach <strong className="text-emerald-600">Excellent</strong> rating
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
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        {['Task', 'Category', 'Priority', 'Due Date', 'Source', 'Status', 'Update Status', 'Actions'].map(h => (
                                            <th key={h} className={cls.tableHead}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map(task => (
                                        <tr key={task.id} className={cls.tableRow}>
                                            <td className={`${cls.tableCell} max-w-[220px]`}>
                                                <p className={cls.heading}>{task.title}</p>
                                                {task.notes && <p className={cls.hintXs}>{task.notes}</p>}
                                            </td>
                                            <td className={cls.tableCell}>
                                                <span className={cls.hintXs}>{task.category}</span>
                                            </td>
                                            <td className={cls.tableCell}>
                                                <Badge className={`text-xs border ${PRIORITY_BADGE[task.priority]}`}>
                                                    {task.priority}
                                                </Badge>
                                            </td>
                                            <td className={`${cls.tableCell} text-xs font-mono`}>{task.dueDate}</td>
                                            <td className={cls.tableCell}>
                                                <Badge variant="outline" className="text-xs">
                                                    {task.assignedBy === 'admin' ? '👤 Admin' : '🙋 Self'}
                                                </Badge>
                                            </td>
                                            <td className={cls.tableCell}>
                                                <Badge className={`${STATUS_BADGE[task.status]} border text-xs flex items-center gap-1 w-fit`}>
                                                    {STATUS_ICON[task.status]}
                                                    {task.status}
                                                </Badge>
                                            </td>
                                            <td className={cls.tableCell}>
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
                                            </td>
                                            <td className={cls.tableCell}>
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-7 w-7 text-blue-600 hover:text-blue-700"
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
                                                        className="h-7 w-7 text-red-600 hover:text-red-700"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteClick(task.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
