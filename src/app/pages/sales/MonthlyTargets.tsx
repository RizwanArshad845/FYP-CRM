import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { TrendingUp, TrendingDown, ShoppingCart, Target, Pencil, Check } from 'lucide-react';
import { StatCard } from '../../components/shared/StatCard';
import { cls } from '../../styles/classes';
import { useAuth } from '../../context/AuthContext';
import { useAgentTargets } from '../../context/AgentTargetContext';
import { toast } from 'sonner';
function pctColor(pct: number) {
  if (pct >= 90) return 'text-success';
  if (pct >= 70) return 'text-warning';
  return 'text-danger';
}

export function MonthlyTargets() {
  const { user } = useAuth();
  const { targets, updateAchieved } = useAgentTargets();
  const [editDrafts, setEditDrafts] = useState<Record<number, string>>({});

  // Each agent sees only their own targets
  const myTargets = targets.filter(t => t.agentName === user?.name || t.agentId === user?.id);

  // Find this month's personal target (if assigned)
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const myCurrentTarget = myTargets.find(t => t.month === currentMonth);

  // Use personal target if available, fall back to 0
  const displayTarget = myCurrentTarget?.target ?? 0;
  const displayAchieved = myCurrentTarget?.achieved ?? 0;
  const displayLeft = Math.max(0, displayTarget - displayAchieved);
  const progressPct = displayTarget > 0 ? Math.min(100, Math.round((displayAchieved / displayTarget) * 100)) : 0;

  const startEdit = (id: number, current: number) =>
    setEditDrafts(prev => ({ ...prev, [id]: current > 0 ? String(current) : '' }));

  const saveEdit = (id: number) => {
    const val = Number(editDrafts[id]);
    
    // Find the target to check against its goal
    const target = targets.find(t => t.id === id);
    if (target && val > target.target) {
      toast.error(`Revenue achieved ($${val}) cannot exceed target ($${target.target})`);
      return;
    }

    if (!isNaN(val) && val >= 0) updateAchieved(id, val);
    setEditDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  return (
    <div className={cls.page}>
      {/* Stat Cards */}
      <div className={cls.gridResponsive2}>
        <StatCard icon={<Target className="h-4 w-4 text-primary" />} title="My Target" value={`$ ${displayTarget.toLocaleString()}`} subtitle={myCurrentTarget ? currentMonth : 'No target set'} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-success" />} title="Achieved" value={`$ ${displayAchieved.toLocaleString()}`} subtitle={`${progressPct}% of target`} valueClassName="text-success" />
        <StatCard icon={<TrendingDown className="h-4 w-4 text-warning" />} title="Remaining" value={`$ ${displayLeft.toLocaleString()}`} subtitle={`${100 - progressPct}% left`} valueClassName="text-warning" />
        <StatCard icon={<ShoppingCart className="h-4 w-4 text-primary" />} title="Total Targets" value={String(myTargets.length)} subtitle="Assigned periods" />
      </div>

      {/* Progress Bar */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Monthly Revenue Progress</CardTitle>
          <CardDescription>Progress towards your monthly target</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cls.list}>
            <div className={cls.row}>
              <span className={cls.label}>Progress</span>
              <span className={`${cls.metric} ${pctColor(progressPct)}`}>{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-4" />
          </div>
        </CardContent>
      </Card>

      {/* My Target History — editable achieved */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>My Target History</CardTitle>
          <CardDescription>Update your achieved amount — Remaining adjusts automatically</CardDescription>
        </CardHeader>
        <CardContent>
          {myTargets.length === 0 ? (
            <p className={cls.hint}>No target assigned yet. Ask your Sales Manager to assign a target.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    {['Month', 'Target', 'Achieved', 'Remaining', '% Hit', 'Update'].map(h => (
                      <TableHead key={h} className={cls.tableHead}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {myTargets.map(t => {
                    const pct = t.target > 0 ? Math.min(100, Math.round((t.achieved / t.target) * 100)) : 0;
                    const remaining = Math.max(0, t.target - t.achieved);
                    const isEditing = t.id in editDrafts;

                    return (
                      <TableRow key={t.id} className={cls.tableRow}>
                        <TableCell className={`${cls.tableCell} ${cls.heading}`}>{t.month}</TableCell>
                        <TableCell className={`${cls.tableCell} font-mono`}>$ {t.target.toLocaleString()}</TableCell>

                        {/* Achieved — inline editable */}
                        <TableCell className={cls.tableCell}>
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              className="h-7 w-28 text-xs font-mono"
                              value={editDrafts[t.id]}
                              onChange={e => setEditDrafts(prev => ({ ...prev, [t.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && saveEdit(t.id)}
                              autoFocus
                            />
                          ) : (
                            <span className="font-mono">
                              {t.achieved > 0
                                ? `$ ${t.achieved.toLocaleString()}`
                                : <span className={cls.hint}>—</span>}
                            </span>
                          )}
                        </TableCell>

                        {/* Remaining — auto calculated */}
                        <TableCell className={`${cls.tableCell} font-mono text-warning`}>
                          {t.achieved > 0
                            ? `$ ${remaining.toLocaleString()}`
                            : <span className={cls.hint}>—</span>}
                        </TableCell>

                        {/* % Hit */}
                        <TableCell className={cls.tableCell}>
                          {t.achieved > 0
                            ? <span className={`font-bold ${pctColor(pct)}`}>{pct}%</span>
                            : <span className={cls.hint}>In progress</span>}
                        </TableCell>

                        {/* Edit / Save button (ONLY for current month, restricted to sales_manager) */}
                        <TableCell className={cls.tableCell}>
                          {t.month === currentMonth && user?.role === 'sales_manager' ? (
                            isEditing ? (
                              <Button size="sm" onClick={() => saveEdit(t.id)} className="h-7 px-2">
                                <Check className="h-3.5 w-3.5 mr-1" />Save
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => startEdit(t.id, t.achieved)} className="h-7 px-2">
                                <Pencil className="h-3.5 w-3.5 mr-1" />Update
                              </Button>
                            )
                          ) : (
                            <span className={cls.hint}>{t.month === currentMonth ? 'Assigned' : 'Closed'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
