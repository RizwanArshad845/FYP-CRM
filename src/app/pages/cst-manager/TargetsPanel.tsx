import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Target, Pencil, Clock, Trash2, X } from 'lucide-react';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { useClientInbox } from '../../context/ClientInboxContext';
import { useEmployees } from '../../context/EmployeeContext';

function targetPct(achieved: number, target: number) {
    if (target === 0) return 0;
    return Math.round((achieved / target) * 100);
}

function pctColor(pct: number) {
    if (pct >= 80) return 'text-success';
    if (pct >= 60) return 'text-warning';
    return 'text-danger';
}

export function TargetsPanel() {
    const { targets, upsertTarget, deleteTarget } = useClientInbox();
    const { employees } = useEmployees();
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const [agentId, setAgentId] = useState<number | null>(null);
    const [targetClients, setTargetClients] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const cstAgents = employees.filter(e => e.role === 'cst' || e.role === 'cst_manager');

    const handleSet = () => {
        if (!agentId || !targetClients || !targetAmount) { toast.error('Select an agent and enter both targets'); return; }
        const numClients = Number(targetClients);
        const numAmount = Number(targetAmount);
        if (isNaN(numClients) || numClients <= 0) {
            toast.error('Client target must be a positive number');
            return;
        }
        if (isNaN(numAmount) || numAmount < 0) {
            toast.error('Amount target cannot be negative');
            return;
        }
        const agent = cstAgents.find(a => a.id === agentId);
        upsertTarget(agentId, agent?.name ?? '', currentMonth, numClients, numAmount);
        toast.success(`${isEditing ? 'Target updated' : 'Target set'} for ${agent?.name} — ${currentMonth}`);
        resetForm();
    };

    const resetForm = () => {
        setAgentId(null);
        setTargetClients('');
        setTargetAmount('');
        setIsEditing(false);
    };

    const handleEdit = (t: any) => {
        setAgentId(t.agent_id);
        setTargetClients(t.target_clients.toString());
        setTargetAmount(t.target_amount.toString());
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this target?')) {
            deleteTarget(id);
        }
    };

    const currentTargets = targets.filter(t => t.target_month === currentMonth);
    const availableAgents = cstAgents.filter(a => {
        const hasTarget = currentTargets.some(t => t.agent_id === a.id);
        return !hasTarget || (isEditing && a.id === agentId);
    });

    return (
        <div className={cls.page}>
            <Card className={isEditing ? 'ring-2 ring-primary' : ''}>
                <CardHeader>
                    <div className={cls.row}>
                        <div>
                            <CardTitle className={cls.inline}>
                                <Target className="h-5 w-5" />{isEditing ? 'Update' : 'Set'} Monthly Target
                            </CardTitle>
                            <CardDescription>Assign client onboarding targets to CST agents for {currentMonth}</CardDescription>
                        </div>
                        {isEditing && (
                            <Button variant="ghost" size="sm" onClick={resetForm}>
                                <X className="h-4 w-4 mr-2" /> Cancel Edit
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 flex-wrap items-end">
                        <div className={`${cls.field} flex-1 min-w-[200px]`}>
                            <Label>CST Agent</Label>
                            <Select value={agentId !== null ? String(agentId) : ''} onValueChange={v => setAgentId(Number(v))} disabled={isEditing}>
                                <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                                <SelectContent>
                                    {availableAgents.map(a => (
                                        <SelectItem key={a.id} value={String(a.id)}>{a.name} — {a.role}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className={`${cls.field} flex-1 min-w-[160px]`}>
                            <Label>Target (# Clients)</Label>
                            <Input
                                type="number"
                                min="1"
                                placeholder="e.g. 12"
                                value={targetClients}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === '' || Number(val) >= 0) setTargetClients(val);
                                }}
                            />
                        </div>
                        <div className={`${cls.field} flex-1 min-w-[160px]`}>
                            <Label>Target ($ Amount)</Label>
                            <Input
                                type="number"
                                min="0"
                                placeholder="e.g. 5000"
                                value={targetAmount}
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val === '' || Number(val) >= 0) setTargetAmount(val);
                                }}
                            />
                        </div>
                        <Button onClick={handleSet}>
                            <Pencil className="h-4 w-4 mr-2" />{isEditing ? 'Update Target' : 'Set Target'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
