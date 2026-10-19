import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../../utils/api';
import { useClients, type ManagedClient } from '../../context/ClientContext';
import { usePortals } from '../../hooks/usePortals';
import { cn } from '../ui/utils';

export type ClientView = 'table' | 'kanban';

const NO_STAGE = 0;

const daysIn = (c: ManagedClient) => {
  const since = new Date(c.stage_changed_at ?? c.created_at).getTime();
  const days = Math.max(0, Math.floor((Date.now() - since) / 86_400_000));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
};

/**
 * Toolbar of Figure 4.4: the drag hint and the "Table view | Kanban view" toggle.
 * Without pipeline stages the Kanban view is disabled with a hint.
 */
export function ClientViewToggle({ view, onChange }: { view: ClientView; onChange: (view: ClientView) => void }) {
  const { pipelineStages } = useClients();
  const noStages = pipelineStages.length === 0;
  const segment = (value: ClientView, label: string, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? 'Add pipeline stages in Organization Settings' : undefined}
      onClick={() => onChange(value)}
      className={cn(
        'px-[14px] py-[7px] text-[13px] font-normal',
        view === value ? 'bg-primary text-white' : 'bg-card text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">
        {noStages
          ? 'Add pipeline stages in Organization Settings'
          : view === 'kanban' ? 'Dragging a card changes the stage only; the client status is not affected.' : ''}
      </span>
      <div className="flex overflow-hidden rounded-[8px] border border-input-border">
        {segment('table', 'Table view')}
        {segment('kanban', 'Kanban view', noStages)}
      </div>
    </div>
  );
}

/**
 * Clients by pipeline stage (plan 6.3). Dropping a card on a column moves the client
 * to that stage; the status never changes. Cards show no field-group data.
 */
export function PipelineKanbanBoard({ clients }: { clients: ManagedClient[] }) {
  const { pipelineStages, fetchData } = useClients();
  const { can } = usePortals();
  const canMove = can('client.move_stage');
  const [dragId, setDragId] = useState<number | null>(null);
  const [overColumn, setOverColumn] = useState<number | null>(null);
  // Optimistic stage per client until the list reloads
  const [moved, setMoved] = useState<Record<number, { stage_id: number; stage_changed_at: string }>>({});

  const withMoves = clients.map((c) => (moved[c.id] ? { ...c, ...moved[c.id] } : c));
  const stageIds = new Set(pipelineStages.map((s) => s.id));
  const unstaged = withMoves.filter((c) => !c.stage_id || !stageIds.has(c.stage_id));
  const columns = [
    ...(unstaged.length ? [{ id: NO_STAGE, name: 'No stage', cards: unstaged }] : []),
    ...pipelineStages.map((s) => ({ id: s.id, name: s.stage_name, cards: withMoves.filter((c) => c.stage_id === s.id) })),
  ];

  const drop = async (stageId: number) => {
    const client = withMoves.find((c) => c.id === dragId);
    setDragId(null);
    setOverColumn(null);
    if (!client || stageId === NO_STAGE || client.stage_id === stageId) return;
    setMoved((m) => ({ ...m, [client.id]: { stage_id: stageId, stage_changed_at: new Date().toISOString() } }));
    try {
      await apiFetch(`/clients/${client.id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage_id: stageId }) });
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Could not move the client');
    } finally {
      setMoved((m) => {
        const next = { ...m };
        delete next[client.id];
        return next;
      });
    }
  };

  return (
    <div className="flex gap-[14px] overflow-x-auto pb-2">
      {columns.map((col) => (
        <div
          key={col.id}
          onDragOver={(e) => { if (canMove && col.id !== NO_STAGE) { e.preventDefault(); setOverColumn(col.id); } }}
          onDragLeave={() => setOverColumn((c) => (c === col.id ? null : c))}
          onDrop={(e) => { e.preventDefault(); drop(col.id); }}
          className={cn(
            'min-h-[420px] min-w-[170px] flex-1 rounded-[10px] bg-kanban p-[10px]',
            overColumn === col.id && 'outline-2 outline-dashed outline-primary/50',
          )}
        >
          <div className="flex justify-between px-1 pt-1 pb-[10px] text-[13.5px] font-bold">
            {col.name} <span className="font-normal text-muted-foreground">{col.cards.length}</span>
          </div>
          {col.cards.map((c) => (
            <div
              key={c.id}
              draggable={canMove}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(c.id); }}
              onDragEnd={() => { setDragId(null); setOverColumn(null); }}
              className={cn(
                'mb-[10px] rounded-[8px] border border-[#dfe4ee] bg-card px-3 py-[11px] text-[13px] dark:border-border',
                canMove && 'cursor-grab',
                dragId === c.id && 'rotate-[-2deg] border-primary shadow-[0_10px_24px_rgba(30,42,68,.25)]',
              )}
            >
              <b className="mb-[5px] block text-[14px]">{c.company_name}</b>
              <div className="flex justify-between text-muted-foreground">
                <span>{c.assigned_name?.split(' ')[0] || '—'}</span>
                <span>{daysIn(c)}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
