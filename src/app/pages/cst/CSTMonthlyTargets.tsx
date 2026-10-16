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
  if (pct >= 90) return 'text-green-600';
  if (pct >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

export function CSTMonthlyTargets() {
  const { user } = useAuth();
  const { targets, updateAchieved, updateAchievedClients } = useAgentTargets();
  const [editDrafts, setEditDrafts] = useState<Record<number, { amount: string, clients: string }>>({});

  // Each agent sees only their own targets assigned by their CST manager
  const myTargets = targets.filter(t => (
    t.type === 'cst' && (
      String(t.agentId) === String(user?.id) || 
      t.agentName === user?.name
    )
  ));

  // Find this month's personal target (if assigned)
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const myCurrentTarget = myTargets.find(t => t.month === currentMonth);

  const displayTargetClients = myCurrentTarget?.targetClients ?? 0;
  const displayAchievedClients = myCurrentTarget?.achievedClients ?? 0;
  const progressPctClients = displayTargetClients > 0 ? Math.min(100, Math.round((displayAchievedClients / displayTargetClients) * 100)) : 0;

  const displayTargetAmount = myCurrentTarget?.targetAmount ?? 0;
  const displayAchievedAmount = myCurrentTarget?.achievedAmount ?? 0;
  const progressPctAmount = displayTargetAmount > 0 ? Math.min(100, Math.round((displayAchievedAmount / displayTargetAmount) * 100)) : 0;

  const startEdit = (id: number, amount: number, clients: number) =>
    setEditDrafts(prev => ({ ...prev, [id]: { amount: String(amount), clients: String(clients) } }));

  const saveEdit = (id: number, type: 'sales' | 'cst') => {
    const draft = editDrafts[id];
    if (!draft) return;

    const amountVal = Number(draft.amount);
    const clientsVal = Number(draft.clients);

    // Find the target to check against its goal
    const target = targets.find(t => t.id === id);
    if (target) {
      if (amountVal > (target.targetAmount || 0)) {
        toast.error(`Revenue achieved ($${amountVal}) cannot exceed target ($${target.targetAmount})`);
        return;
      }
      if (clientsVal > (target.targetClients || 0)) {
        toast.error(`Clients achieved (${clientsVal}) cannot exceed target goal (${target.targetClients})`);
        return;
      }
    }

    if (!isNaN(amountVal) && amountVal >= 0) {
      updateAchieved(id, amountVal, type);
    }
    
    if (type === 'cst' && !isNaN(clientsVal) && clientsVal >= 0) {
      updateAchievedClients(id, clientsVal);
    }

    setEditDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  return (
    <div className={cls.page}>
      {/* Stat Cards */}
      <div className={cls.gridResponsive2}>
        <StatCard icon={<Target className="h-4 w-4 text-blue-500" />} title="Client Target" value={String(displayTargetClients)} subtitle={myCurrentTarget ? currentMonth : 'No target set'} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-green-500" />} title="Clients Achieved" value={String(displayAchievedClients)} subtitle={`${progressPctClients}% of target`} valueClassName="text-green-600" />
        <StatCard icon={<Target className="h-4 w-4 text-purple-500" />} title="Revenue Target" value={`$${displayTargetAmount.toLocaleString()}`} subtitle={myCurrentTarget ? currentMonth : 'No target set'} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} title="Revenue Achieved" value={`$${displayAchievedAmount.toLocaleString()}`} subtitle={`${progressPctAmount}% of target`} valueClassName="text-emerald-600" />
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Client Goal Progress</CardTitle>
            <CardDescription>Automated from client assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cls.list}>
              <div className={cls.row}>
                <span className={cls.label}>Progress ({displayAchievedClients}/{displayTargetClients})</span>
                <span className={`${cls.metric} ${pctColor(progressPctClients)}`}>{progressPctClients}%</span>
              </div>
              <Progress value={progressPctClients} className="h-4 bg-blue-100" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Revenue Goal Progress</CardTitle>
            <CardDescription>Manually updated target tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cls.list}>
              <div className={cls.row}>
                <span className={cls.label}>Progress (${displayAchievedAmount}/${displayTargetAmount})</span>
                <span className={`${cls.metric} ${pctColor(progressPctAmount)}`}>{progressPctAmount}%</span>
              </div>
              <Progress value={progressPctAmount} className="h-4 bg-purple-100" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Target History — editable achieved */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>My Target History</CardTitle>
          <CardDescription>Update your achieved amount — Remaining adjusts automatically</CardDescription>
        </CardHeader>
        <CardContent>
          {myTargets.length === 0 ? (
            <p className={cls.hint}>No target assigned yet. Ask your CST Manager to assign a target.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {['Month', 'Client Goal', 'Client Achieved', 'Rev Goal', 'Rev Achieved', 'Rev Left', '% Hit', 'Update'].map(h => (
                      <th key={h} className={cls.tableHead}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {myTargets.map(t => {
                    const totalTarget = (t.targetAmount || 0) + (t.targetClients || 0);
                    const totalAchieved = (t.achievedAmount || 0) + (t.achievedClients || 0);
                    const revPct = (t.targetAmount || 0) > 0 ? Math.min(100, Math.round(((t.achievedAmount || 0) / (t.targetAmount || 1)) * 100)) : 0;
                    const remainingRev = Math.max(0, (t.targetAmount || 0) - (t.achievedAmount || 0));
                    const isEditing = t.id in editDrafts;

                    return (
                      <tr key={t.id} className={cls.tableRow}>
                        <td className={`${cls.tableCell} ${cls.heading}`}>{t.month}</td>
                        <td className={`${cls.tableCell} font-mono`}>{t.targetClients}</td>
                        
                        {/* Client Achieved — inline editable */}
                        <td className={cls.tableCell}>
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              className="h-7 w-20 text-xs font-mono"
                              value={editDrafts[t.id].clients}
                              onChange={e => setEditDrafts(prev => ({ ...prev, [t.id]: { ...prev[t.id], clients: e.target.value } }))}
                              onKeyDown={e => e.key === 'Enter' && saveEdit(t.id, t.type)}
                            />
                          ) : (
                            <span className="font-mono">{t.achievedClients}</span>
                          )}
                        </td>

                        <td className={`${cls.tableCell} font-mono`}>${(t.targetAmount || 0).toLocaleString()}</td>

                        {/* Rev Achieved — inline editable */}
                        <td className={cls.tableCell}>
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              className="h-7 w-24 text-xs font-mono"
                              value={editDrafts[t.id].amount}
                              onChange={e => setEditDrafts(prev => ({ ...prev, [t.id]: { ...prev[t.id], amount: e.target.value } }))}
                              onKeyDown={e => e.key === 'Enter' && saveEdit(t.id, t.type)}
                              autoFocus
                            />
                          ) : (
                            <span className="font-mono">
                              {(t.achievedAmount || 0) > 0
                                ? '$' + (t.achievedAmount || 0).toLocaleString()
                                : <span className={cls.hint}>—</span>}
                            </span>
                          )}
                        </td>

                        {/* Remaining — auto calculated */}
                        <td className={`${cls.tableCell} font-mono text-orange-600`}>
                          {(t.achievedAmount || 0) > 0
                            ? '$' + remainingRev.toLocaleString()
                            : <span className={cls.hint}>—</span>}
                        </td>

                        {/* % Hit */}
                        <td className={cls.tableCell}>
                          {(t.achievedAmount || 0) > 0
                            ? <span className={`font-bold ${pctColor(revPct)}`}>{revPct}%</span>
                            : <span className={cls.hint}>In progress</span>}
                        </td>

                        {/* Edit / Save button (ONLY for current month) */}
                        <td className={cls.tableCell}>
                          {t.month === currentMonth ? (
                            isEditing ? (
                              <Button size="sm" onClick={() => saveEdit(t.id, t.type)} className="h-7 px-2">
                                <Check className="h-3.5 w-3.5 mr-1" />Save
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => startEdit(t.id, t.achievedAmount || 0, t.achievedClients || 0)} className="h-7 px-2">
                                <Pencil className="h-3.5 w-3.5 mr-1" />Update
                              </Button>
                            )
                          ) : (
                            <span className={cls.hint}>Closed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
