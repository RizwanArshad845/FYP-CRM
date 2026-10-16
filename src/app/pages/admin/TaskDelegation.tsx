import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Send, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cls } from '../../styles/classes';
import { useManagerTasks, type TaskPriority } from '../../context/ManagerTaskContext';
import { useCSTManagerTasks, type CSTTaskPriority } from '../../context/CSTManagerTaskContext';
import { useEmployees } from '../../context/EmployeeContext';

// ── Shared constants ──────────────────────────────────────────────────────────
const MGR_CATEGORIES = ['Management', 'Sales', 'Report', 'HR', 'Admin', 'Coaching', 'Strategy', 'Other'];
const CST_CATEGORIES = ['Management', 'Onboarding', 'Escalation', 'Client', 'Report', 'Admin',  'Other'];

// ── Admin → Sales Manager task card ──────────────────────────────────────────
const EMPTY_MGR_TASK = { title: '', priority: 'medium' as TaskPriority, dueDate: '', category: 'Management', notes: '' };

function AssignToSalesManagerPanel() {
  const { addTask } = useManagerTasks();
  const { employees } = useEmployees();
  const [isAssigning, setIsAssigning] = useState(false);
  const [form, setForm] = useState(EMPTY_MGR_TASK);
  const [targetManagerId, setTargetManagerId] = useState<string>('');
  const salesManagers = employees.filter(e => e.role === 'sales_manager');

  const set = <K extends keyof typeof EMPTY_MGR_TASK>(k: K, v: (typeof EMPTY_MGR_TASK)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleAssign = async () => {
    if (!targetManagerId) {
      toast.error('Please select a Sales Manager');
      return;
    }
    if (!form.title.trim() || !form.dueDate) {
      toast.error('Please fill in title and due date');
      return;
    }
    if (isAssigning) return;

    const salesManager = salesManagers.find(e => e.id.toString() === targetManagerId);
    if (!salesManager) {
      toast.error('Selected Manager not found');
      return;
    }

    setIsAssigning(true);
    try {
      await addTask({ ...form, status: 'pending', assignedBy: 'admin' }, salesManager.id);
      toast.success(`Task assigned to ${salesManager.name}`);
      setForm(EMPTY_MGR_TASK);
      setTargetManagerId('');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className={`${cls.inline} text-blue-700 dark:text-blue-400`}>
          <ShieldCheck className="h-5 w-5" />
          Assign Task to Sales Manager
        </CardTitle>
        <CardDescription>Add a task directly to the Sales Manager&apos;s board</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={cls.field}>
            <Label>Select Sales Manager *</Label>
            <Select value={targetManagerId} onValueChange={setTargetManagerId}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                {salesManagers.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className={`${cls.field} sm:col-span-2`}>
            <Label>Task Title *</Label>
            <Input
              placeholder="e.g. Submit Q2 forecast"
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
                {MGR_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className={cls.field}>
            <Label>Due Date *</Label>
            <Input type="date" min={new Date().toISOString().split('T')[0]} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>
          <div className={`${cls.field} sm:col-span-2`}>
            <Label>Notes</Label>
            <Textarea
              rows={2}
              placeholder="Instructions for the Sales Manager..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={handleAssign} disabled={isAssigning}>
          <Send className="h-4 w-4 mr-2" />
          {isAssigning ? 'Assigning...' : 'Assign to Sales Manager'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Admin → CST Manager task card ────────────────────────────────────────────
const EMPTY_CST_TASK = { title: '', priority: 'medium' as CSTTaskPriority, dueDate: '', category: 'Management', notes: '' };

function AssignToCSTManagerPanel() {
  const { addTask } = useCSTManagerTasks();
  const { employees } = useEmployees();
  const [isAssigning, setIsAssigning] = useState(false);
  const [form, setForm] = useState(EMPTY_CST_TASK);
  const [targetManagerId, setTargetManagerId] = useState<string>('');
  const cstManagers = employees.filter(e => e.role === 'cst_manager');

  const set = <K extends keyof typeof EMPTY_CST_TASK>(k: K, v: (typeof EMPTY_CST_TASK)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleAssign = async () => {
    if (!targetManagerId) {
      toast.error('Please select a CST Manager');
      return;
    }
    if (!form.title.trim() || !form.dueDate) {
      toast.error('Please fill in title and due date');
      return;
    }
    if (isAssigning) return;

    const cstManager = cstManagers.find(e => e.id.toString() === targetManagerId);
    if (!cstManager) {
      toast.error('Selected Manager not found');
      return;
    }

    setIsAssigning(true);
    try {
      await addTask({ ...form, status: 'pending', assignedBy: 'admin' }, cstManager.id);
      toast.success(`Task assigned to ${cstManager.name}`);
      setForm(EMPTY_CST_TASK);
      setTargetManagerId('');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Card className="border-2 border-emerald-200 dark:border-emerald-800">
      <CardHeader>
        <CardTitle className={`${cls.inline} text-emerald-700 dark:text-emerald-400`}>
          <Users className="h-5 w-5" />
          Assign Task to CST Manager
        </CardTitle>
        <CardDescription>Add a task directly to the CST Manager&apos;s board</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={cls.field}>
            <Label>Select CST Manager *</Label>
            <Select value={targetManagerId} onValueChange={setTargetManagerId}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                {cstManagers.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className={`${cls.field} sm:col-span-2`}>
            <Label>Task Title *</Label>
            <Input
              placeholder="e.g. Monthly client health audit"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>
          <div className={cls.field}>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => set('priority', v as CSTTaskPriority)}>
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
                {CST_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className={cls.field}>
            <Label>Due Date *</Label>
            <Input type="date" min={new Date().toISOString().split('T')[0]} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>
          <div className={`${cls.field} sm:col-span-2`}>
            <Label>Notes</Label>
            <Textarea
              rows={2}
              placeholder="Instructions for the CST Manager..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleAssign}
          disabled={isAssigning}
        >
          <Send className="h-4 w-4 mr-2" />
          {isAssigning ? 'Assigning...' : 'Assign to CST Manager'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TaskDelegation() {
  return (
    <div className={cls.page}>
      <AssignToSalesManagerPanel />
      <AssignToCSTManagerPanel />
    </div>
  );
}
