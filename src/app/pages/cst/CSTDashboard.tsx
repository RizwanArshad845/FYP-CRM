import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  Users, Calendar, Flag, UserPlus, Clock,
  PowerOff, Power, AlertTriangle, CheckCircle2, Search,
  Plus, Edit, Trash2, StickyNote, List,
  Maximize2, Minimize2
} from 'lucide-react';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { WelcomeHero } from '../../components/shared/WelcomeHero';
import { cls } from '../../styles/classes';
import { getPortalTheme } from '../../styles/portal-themes';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { Notepad } from '../../components/shared/Notepad';
import { InternalConcerns } from './InternalConcerns';
import { CSTMonthlyTargets } from './CSTMonthlyTargets';

import { useClients } from '../../context/ClientContext';
import { useAuth, useOrgPath } from '../../context/AuthContext';
import { useCSTSchedule, Schedule as CSTSchedule } from '../../context/CSTScheduleContext';
import { useConcerns } from '../../context/ConcernContext';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

const theme = getPortalTheme('cst');

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-muted text-muted-foreground',
  'in-progress': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  done: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

// ── Schedule type matching DB: schedules(id, user_id, title, description, start_time, end_time)
type ScheduleForm = { title: string; description: string; start_time: string; end_time: string };
const EMPTY_SCHEDULE_FORM: ScheduleForm = { title: '', description: '', start_time: '', end_time: '' };

const FLAG_BORDER_COLORS: Record<string, string> = {
  'red-flag': '#ef4444',
  'yellow-flag': '#eab308',
  'black-flag': '#111827',
  'flagged': '#ef4444'
};

const FLAG_OPTIONS: { value: string; label: string }[] = [
  { value: 'red-flag', label: '🔴 Red Flag — Urgent issue' },
  { value: 'yellow-flag', label: '🟡 Yellow Flag — Watch closely' },
  { value: 'black-flag', label: '⚫ Black Flag — Churn / Cancel' },
];

// ── Flag dialog (CST Agent only) ──────────────────────────────────────────────
interface FlagDialogProps {
  clientName: string;
  clientId: number;
  open: boolean;
  onClose: () => void;
}

function FlagDialog({ clientName, clientId, open, onClose }: FlagDialogProps) {
  const [flagType, setFlagType] = useState<string>('yellow-flag');
  const [issue, setIssue] = useState('');
  const [isFlagging, setIsFlagging] = useState(false);
  const { flagClient } = useClients();

  const handleSubmit = async () => {
    if (!issue.trim() || isFlagging) { toast.error('Please describe the issue'); return; }
    setIsFlagging(true);
    try {
      await flagClient(clientId, flagType, issue);
      setIssue('');
      onClose();
    } finally {
      setIsFlagging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={cls.inline}><Flag className="h-5 w-5 text-red-500" />Flag Client</DialogTitle>
          <DialogDescription>Flagging <strong>{clientName}</strong> — this will notify the CST Manager.</DialogDescription>
        </DialogHeader>
        <div className={cls.section}>
          <div className={cls.field}>
            <Label>Flag Type</Label>
            <Select value={flagType} onValueChange={v => setFlagType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FLAG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className={cls.field}>
            <Label>Issue Description *</Label>
            <Input placeholder="Describe the issue..." value={issue} onChange={e => setIssue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isFlagging}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isFlagging}>
            <Flag className="h-4 w-4 mr-2" />
            {isFlagging ? 'Flagging...' : 'Submit Flag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Client Details Dialog ───────────────────────────────────────────────────────
function ClientDetailsDialog({ clientId, open, onClose }: { clientId: number, open: boolean, onClose: () => void }) {
  const { clients, getClientNotes } = useClients();
  const client = clients.find(c => c.id === clientId);
  const [notes, setNotes] = useState<any[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (open && clientId) {
      setIsLoadingNotes(true);
      getClientNotes(clientId).then(data => {
        setNotes(data);
        setIsLoadingNotes(false);
      });
    }
  }, [open, clientId, getClientNotes]);

  // Reset fullscreen when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => setIsFullscreen(false), 200);
    }
  }, [open]);

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        className={isFullscreen
          ? "max-w-[100vw] sm:max-w-[100vw] w-screen h-screen max-h-[100vh] border-0 rounded-none overflow-y-auto !p-8 duration-300 transition-all"
          : "max-w-5xl sm:max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw] duration-300 transition-all"}
      >
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute top-4 right-12 rounded-sm opacity-70 transition-opacity hover:opacity-100 hover:bg-muted p-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background z-50"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <span className="sr-only">Toggle fullscreen</span>
        </button>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            {client.company_name}
          </DialogTitle>
          <DialogDescription>
            Client complete details and history. Added on {new Date(client.created_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">General Info</h3>
              <div className="bg-muted/30 p-5 rounded-xl space-y-3.5 text-base border shadow-sm">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">Customer Name:</span> <span className="font-medium text-right">{client.customer_name}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">CIN:</span> <span className="font-medium text-right">{client.cin || 'N/A'}</span></div>
                <div className="flex justify-between items-center gap-4"><span className="text-muted-foreground whitespace-nowrap">Status:</span> <Badge variant="outline" className="capitalize px-3 py-1">{client.status}</Badge></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">Service Area:</span> <span className="text-right break-words">{client.service_area || 'N/A'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">Assigned To:</span> <span className="text-right">{client.assigned_name || 'Unassigned'}</span></div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Contact Info</h3>
              <div className="bg-muted/30 p-5 rounded-xl space-y-3.5 text-base border shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4"><span className="text-muted-foreground whitespace-nowrap">Email 1:</span> <span className="text-left sm:text-right break-all">{client.email}</span></div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4"><span className="text-muted-foreground whitespace-nowrap">Email 2:</span> <span className="text-left sm:text-right break-all">{client.email_2 || 'N/A'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">Phone 1:</span> <span className="text-right">{client.contact_no_1}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">Phone 2:</span> <span className="text-right">{client.contact_no_2 || 'N/A'}</span></div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Payment & Services</h3>
              <div className="bg-muted/30 p-5 rounded-xl space-y-3.5 text-base border shadow-sm">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">Amount:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">${client.payment_amount}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">Gateway:</span> <span>{client.payment_gateway || 'N/A'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">Services:</span> <span className="text-right break-words">{client.client_services || 'N/A'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground whitespace-nowrap">Product Sold:</span> <span className="text-right break-words">{client.product_sold || 'N/A'}</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="h-full">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Technical Details</h3>
              <div className="bg-muted/30 p-5 rounded-xl space-y-5 text-base border shadow-sm h-[calc(100%-28px)]">
                <div>
                  <span className="text-muted-foreground font-medium block mb-2">Digital Presence:</span>
                  <p className="bg-background p-4 rounded-lg border shadow-sm break-words min-h-[70px] text-sm leading-relaxed">{client.digital_presence || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium block mb-2">Tips for Tech:</span>
                  <p className="bg-background p-4 rounded-lg border shadow-sm break-words min-h-[70px] text-sm leading-relaxed">{client.tips_for_tech || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium block mb-2">Client Concerns:</span>
                  <p className="bg-background p-4 rounded-lg border shadow-sm break-words min-h-[70px] text-sm leading-relaxed">{client.client_concerns || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium block mb-2">Initial Notes:</span>
                  <p className="bg-background p-4 rounded-lg border shadow-sm break-words min-h-[70px] text-sm leading-relaxed whitespace-pre-wrap">{client.notes || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2 uppercase tracking-wider border-b pb-2">
            <StickyNote className="h-4 w-4 text-amber-500" /> Added Notes & History
          </h3>
          {isLoadingNotes ? (
            <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              No additional notes have been added yet.
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="bg-muted/30 p-3 rounded-lg border border-l-4 border-l-blue-500">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] text-blue-700">
                        {note.creator_name?.charAt(0) || 'U'}
                      </div>
                      {note.creator_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded border font-medium shadow-sm">
                      {new Date(note.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-foreground/90 pl-6 leading-relaxed break-all sm:break-words">{note.note_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Active Clients panel (role-aware) ─────────────────────────────────────────
function ActiveClientsPanel() {
  const { user } = useAuth();
  const { clients, deactivationRequests, toggleActive, requestDeactivation, resolveDeactivationRequest } = useClients();
  const isCSTManager = user?.role === 'cst_manager';
  const isCSTAgent = user?.role === 'cst';

  const [flagTarget, setFlagTarget] = useState<{ id: number; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [detailsTargetId, setDetailsTargetId] = useState<number | null>(null);
  const navigate = useNavigate();

  const handleRequestDeactivation = async (clientId: number, clientName: string) => {
    if (!user) return;
    try {
      await requestDeactivation(clientId, clientName, user.first_name);
    } catch (error) {
      console.error('Request deactivation failed:', error);
    }
  };

  const activeClients = clients.filter(c => c.is_active && c.status === 'active');

  return (
    <div className={cls.section}>
      <Card>
        <CardHeader>
          <div className={cls.row}>
            <div>
              <CardTitle className={cls.inline}>
                <div className="h-3 w-3 rounded-full bg-green-500" />
                Active Clients
              </CardTitle>
              <CardDescription>
                {isCSTManager
                  ? 'Activate or deactivate clients'
                  : isCSTAgent
                    ? 'View client details, flag clients or request deactivation'
                    : `${activeClients.length} currently active clients`}
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search active clients..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm w-[250px]" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>CIN / Details</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {activeClients.filter(c => !search || c.company_name.toLowerCase().includes(search.toLowerCase()) || c.customer_name.toLowerCase().includes(search.toLowerCase())).map(c => (
                  <TableRow key={c.id} className={`${!c.is_active ? 'opacity-60' : ''} hover:bg-muted/30 transition-colors cursor-pointer ${detailsTargetId === c.id ? 'ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : ''}`} onClick={() => setDetailsTargetId(c.id)}>
                    <TableCell>
                      <p className="font-bold">{c.company_name}</p>
                      <p className="text-xs text-muted-foreground">Person: {c.customer_name}</p>
                      <p className="text-xs text-muted-foreground italic">Added: {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm"><span className="font-semibold">CIN:</span> {c.cin || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">Gateway: {c.payment_gateway || 'N/A'}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{c.contact_no_1 || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">{c.email || 'N/A'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.payment_gateway || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{c.assigned_name || 'Unassigned'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-xs">
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {deactivationRequests.some(r => r.client_id === c.id) && (
                          <Badge variant="outline" className="text-xs text-orange-700 border-orange-400 bg-orange-50">
                            Requested
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isCSTManager && (
                        <Button size="sm" variant={c.is_active ? 'destructive' : 'default'} onClick={(e) => { e.stopPropagation(); toggleActive(c.id); }} className="h-7 text-xs">
                          {c.is_active ? <><PowerOff className="h-3 w-3 mr-1" />Deactivate</> : <><Power className="h-3 w-3 mr-1" />Activate</>}
                        </Button>
                      )}
                      {isCSTAgent && (
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-orange-400 text-orange-700 hover:bg-orange-50" onClick={(e) => { e.stopPropagation(); setFlagTarget({ id: c.id, name: c.company_name }); }}>
                            <Flag className="h-3 w-3 mr-1" />Flag
                          </Button>
                          {c.is_active && !deactivationRequests.some(r => r.client_id === c.id) && (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-400 text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleRequestDeactivation(c.id, c.company_name); }}>
                              <AlertTriangle className="h-3 w-3 mr-1" />Deactivate
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {activeClients.filter(c => !search || c.company_name.toLowerCase().includes(search.toLowerCase()) || c.customer_name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No active clients found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pending Deactivation Requests — CST Manager only */}
      {isCSTManager && deactivationRequests.length > 0 && (
        <Card className="border-2 border-orange-300 dark:border-orange-700">
          <CardHeader>
            <CardTitle className={`${cls.inline} text-orange-700 dark:text-orange-400`}>
              <AlertTriangle className="h-5 w-5" />
              Pending Deactivation Requests
            </CardTitle>
            <CardDescription>Requests submitted by CST agents — review and approve or dismiss</CardDescription>
          </CardHeader>
          <CardContent className={cls.list}>
            {deactivationRequests.map(req => (
              <div key={req.client_id} className={`${cls.item} border-orange-200 dark:border-orange-800`}>
                <div className={`${cls.row} mb-3 flex-wrap gap-2`}>
                  <div>
                    <p className={cls.heading}>{req.client_name}</p>
                    <p className={cls.hint}>
                      Requested by <strong>{req.requested_by}</strong> · {new Date(req.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className={`${cls.actions} flex-wrap`}>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      resolveDeactivationRequest(req.id, true, req.client_id);
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve &amp; Deactivate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resolveDeactivationRequest(req.id, false, req.client_id);
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Flag dialog */}
      {flagTarget && (
        <FlagDialog
          clientId={flagTarget.id}
          clientName={flagTarget.name}
          open={!!flagTarget}
          onClose={() => setFlagTarget(null)}
        />
      )}

      {/* Client Details Dialog */}
      {detailsTargetId && (
        <ClientDetailsDialog
          clientId={detailsTargetId}
          open={!!detailsTargetId}
          onClose={() => setDetailsTargetId(null)}
        />
      )}
    </div>
  );
}

// ── Notes Panel (CRUD) ────────────────────────────────────────────────────────
function NotesPanel() {
  const { user } = useAuth();
  const { clients, getClientNotes, addClientNote, updateClientNote, deleteClientNote } = useClients();
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  const [clientSearch, setClientSearch] = useState('');
  const [noteSearch, setNoteSearch] = useState('');

  // Fetch notes when client changes
  const fetchNotes = async (clientId: number) => {
    const data = await getClientNotes(clientId);
    setNotes(data);
  };

  const handleSelectClient = (id: string) => {
    const clientId = Number(id);
    setSelectedClient(clientId);
    fetchNotes(clientId);
  };

  const handleAddNote = async () => {
    if (!selectedClient || !newNote.trim() || !user) return;
    setIsAdding(true);
    const success = await addClientNote(selectedClient, newNote, user.id);
    if (success) {
      setNewNote('');
      fetchNotes(selectedClient);
    }
    setIsAdding(false);
  };

  const handleUpdateNote = async () => {
    if (editingNoteId === null || !editNoteText.trim()) return;
    setIsUpdatingNote(true);
    const success = await updateClientNote(editingNoteId, editNoteText);
    if (success) {
      setEditingNoteId(null);
      if (selectedClient) fetchNotes(selectedClient);
    }
    setIsUpdatingNote(false);
  };

  const handleDeleteNote = async (id: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    const success = await deleteClientNote(id);
    if (success && selectedClient) fetchNotes(selectedClient);
  };

  // Convert note text to points
  const renderNoteContent = (text: string) => {
    const points = text.split('\n').filter(p => p.trim());
    if (points.length <= 1) return <p className="text-sm whitespace-pre-wrap break-all sm:break-words">{text}</p>;
    return (
      <ul className="list-disc list-inside space-y-1 mt-1">
        {points.map((p, i) => (
          <li key={i} className="text-sm whitespace-pre-wrap break-all sm:break-words">{p.replace(/^[•\-*]\s*/, '')}</li>
        ))}
      </ul>
    );
  };

  const filteredClients = clients
    .filter(c => c.status === 'active' || c.status === 'flagged')
    .filter(c => !clientSearch || c.company_name.toLowerCase().includes(clientSearch.toLowerCase()));

  const filteredNotes = notes.filter(n =>
    !noteSearch ||
    n.note_text.toLowerCase().includes(noteSearch.toLowerCase()) ||
    n.creator_name?.toLowerCase().includes(noteSearch.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Client Selector */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className={cls.inline}><Users className="h-5 w-5 text-blue-500" />Manage Client Notes</CardTitle>
          <CardDescription>Search and select a client to manage their history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter client list..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>

          <Select onValueChange={handleSelectClient} value={selectedClient ? String(selectedClient) : undefined}>
            <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
            <SelectContent>
              {filteredClients.length === 0 ? (
                <SelectItem value="none" disabled>No clients found</SelectItem>
              ) : (
                filteredClients.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <div className="flex items-center gap-2">
                      {c.company_name}
                      {c.status === 'flagged' && <Badge variant="destructive" className="h-4 px-1 text-[8px]">FLAGGED</Badge>}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {selectedClient && (
            <div className={`${cls.muted} p-4 rounded-lg border border-blue-100 dark:border-blue-900/30`}>
              <h4 className="font-semibold mb-2 text-sm">Add New Note</h4>
              <Textarea
                placeholder="Enter notes here... (Use new lines for points)"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                rows={5}
                className="mb-3 text-sm focus-visible:ring-blue-500"
              />
              <Button
                onClick={handleAddNote}
                disabled={isAdding || !newNote.trim()}
                className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
              >
                {isAdding ? (
                  <>Adding Record...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" />Add Record</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes List */}
      <Card className="lg:col-span-2 shadow-md">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className={cls.inline}><StickyNote className="h-5 w-5 text-amber-500" />Client History &amp; Records</CardTitle>
              <CardDescription>
                {selectedClient
                  ? `Timeline for ${clients.find(c => c.id === selectedClient)?.company_name}`
                  : 'Select a client to view and search notes'}
              </CardDescription>
            </div>
            {selectedClient && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search in notes..."
                  value={noteSearch}
                  onChange={e => setNoteSearch(e.target.value)}
                  className="pl-9 h-8 text-xs w-full md:w-[200px]"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className={`${cls.list} max-h-[600px] overflow-y-auto pt-4`}>
          {!selectedClient ? (
            <div className="text-center py-24 text-muted-foreground">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <StickyNote className="h-8 w-8 opacity-20" />
              </div>
              <p className="font-medium">Ready to manage records</p>
              <p className="text-sm">Select a client from the left panel to begin.</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>{noteSearch ? 'No matches found for your search.' : 'No history found for this client yet.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotes.map(note => (
                <div key={note.id} className={`${cls.item} relative group border-l-4 border-l-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700">
                        {note.creator_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground">{note.creator_name}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:bg-blue-100"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditNoteText(note.note_text);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:bg-red-100"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {editingNoteId === note.id ? (
                    <div className="space-y-2 mt-2 p-2 bg-muted/50 rounded-lg">
                      <Textarea
                        value={editNoteText}
                        onChange={e => setEditNoteText(e.target.value)}
                        rows={4}
                        className="text-sm bg-background"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingNoteId(null)} disabled={isUpdatingNote}>Cancel</Button>
                        <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]" onClick={handleUpdateNote} disabled={isUpdatingNote}>
                          {isUpdatingNote ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="pl-8 text-foreground/90">
                      {renderNoteContent(note.note_text)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export function CSTDashboard() {
  const [onboardSearch, setOnboardSearch] = useState('');
  const [flaggedSearch, setFlaggedSearch] = useState('');
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const to = useOrgPath();
  const { clients, unflagClient, isLoading: clientsLoading } = useClients();
  const { schedules, addSchedule, updateSchedule, deleteSchedule, isLoading: scheduleLoading } = useCSTSchedule();
  const { internalConcerns } = useConcerns();
  const [searchParams] = useSearchParams();
  const activeModule = searchParams.get('module') || 'overview';

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(EMPTY_SCHEDULE_FORM);

  // Auto-scroll to highlighted client when navigating from Active Clients
  useEffect(() => {
    const clientParam = searchParams.get('client');
    if (clientParam && activeModule === 'overview') {
      setTimeout(() => {
        const el = document.getElementById('highlighted-client');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [searchParams, activeModule]);

  if (clientsLoading || scheduleLoading) return <LoadingScreen message="Synchronizing Client Portfolios..." />;

  // Filters
  const onboardingClients = clients.filter(c => c.status === 'onboarding');
  const flaggedClients = clients.filter(c => c.status === 'flagged');

  // Schedule helpers
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();
  const getDuration = (start: string, end: string) => {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    return diff >= 60 ? `${Math.floor(diff / 60)}h ${diff % 60}m` : `${diff}m`;
  };
  const isUpcoming = (start: string) => new Date(start) > new Date();

  const openScheduleModal = (sch?: CSTSchedule) => {
    if (sch) {
      setEditingScheduleId(sch.id);
      setScheduleForm({
        title: sch.title,
        description: sch.description,
        start_time: sch.start_time.slice(0, 16), // for datetime-local input
        end_time: sch.end_time.slice(0, 16),
      });
    } else {
      setEditingScheduleId(null);
      setScheduleForm(EMPTY_SCHEDULE_FORM);
    }
    setIsScheduleOpen(true);
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleForm.title || !scheduleForm.start_time || !scheduleForm.end_time) {
      toast.error('Title, start time and end time are required');
      return;
    }

    const now = new Date();
    if (new Date(scheduleForm.start_time) < now && !editingScheduleId) {
      toast.error('Cannot schedule tasks in the past');
      return;
    }

    if (new Date(scheduleForm.end_time) <= new Date(scheduleForm.start_time)) {
      toast.error('End time must be after start time');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingScheduleId !== null) {
        await updateSchedule(editingScheduleId, {
          title: scheduleForm.title,
          description: scheduleForm.description,
          start_time: scheduleForm.start_time,
          end_time: scheduleForm.end_time
        });
      } else {
        await addSchedule({
          user_id: user?.id as number,
          title: scheduleForm.title,
          description: scheduleForm.description,
          start_time: scheduleForm.start_time,
          end_time: scheduleForm.end_time
        });
      }
      setIsScheduleOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteScheduleRow = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    await deleteSchedule(id);
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Customer Success Team Portal" theme={theme} />
      <main className="px-6 py-5">
        {/* Welcome Hero */}
        <div className="w-full">
          {activeModule === 'overview' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
              {/* <WelcomeHero theme={theme}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold mb-1 text-foreground">Client Success Hub</h2>
                    <p className="text-sm text-muted-foreground">Manage clients, onboarding, and daily operations</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{onboardingClients.length}</p>
                      <p className="text-xs text-muted-foreground">Onboarding</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-500 dark:text-red-400">{flaggedClients.length}</p>
                      <p className="text-xs text-muted-foreground">Flagged</p>
                    </div>
                  </div>
                </div>
              </WelcomeHero> */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(to('/dashboard?module=clients&tab=onboarding'))}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                      Pending Onboarding
                      <UserPlus className="h-4 w-4 text-blue-500" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{onboardingClients.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Clients awaiting setup</p>
                  </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(to('/dashboard?module=clients&tab=flagged'))}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                      Flagged Issues
                      <Flag className="h-4 w-4 text-red-500" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{flaggedClients.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Clients requiring attention</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className={cls.row}>
                    <div>
                      <CardTitle className={cls.inline}><List className="h-5 w-5" />Client Table</CardTitle>
                      <CardDescription>Comprehensive view of all clients and their current status</CardDescription>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search in table..."
                        value={portfolioSearch}
                        onChange={e => setPortfolioSearch(e.target.value)}
                        className="pl-9 h-9 text-sm w-[250px]"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[600px]">
                    <Table className="w-full text-xs text-left border-collapse">
                      <TableHeader className="bg-muted sticky top-0 z-20 shadow-sm">
                        <TableRow className="border-b border-border">
                          {[
                            'Status', 'Flag', 'Cin', 'Company Name', 'Customer Name', 'Service AREA',
                            'Contact No.1', 'Contact No.2', 'Email',
                            'Tech Notes', 'Notes', 'Date', '$', 'Merchant',
                            'SERVICES'
                          ].map(h => (
                            <TableHead key={h} className="px-4 py-3 font-bold text-foreground uppercase tracking-wider border-r border-border last:border-r-0 min-w-[120px] whitespace-nowrap bg-muted">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-border bg-background text-foreground">
                        {clients
                          .filter(c =>
                            !portfolioSearch ||
                            c.company_name.toLowerCase().includes(portfolioSearch.toLowerCase()) ||
                            c.customer_name.toLowerCase().includes(portfolioSearch.toLowerCase()) ||
                            c.email?.toLowerCase().includes(portfolioSearch.toLowerCase()) ||
                            c.cin?.toLowerCase().includes(portfolioSearch.toLowerCase())
                          )
                          .map((c, idx) => {
                            const isHighlighted = searchParams.get('client') === String(c.id);
                            return (
                              <TableRow key={c.id} className={`hover:bg-muted/50 transition-colors ${isHighlighted ? 'ring-2 ring-yellow-400 bg-yellow-100/70 dark:bg-yellow-950/30' : 'bg-background'}`} id={isHighlighted ? 'highlighted-client' : undefined}>
                                <TableCell className="px-4 py-3 border-r border-border">
                                  <Badge
                                    variant={c.status === 'active' ? 'default' : c.status === 'flagged' ? 'destructive' : 'secondary'}
                                    className="text-[10px] uppercase font-bold px-1.5 h-5"
                                  >
                                    {c.status === 'flagged' && c.flag_type ? `${c.status}: ${c.flag_type.replace('-', ' ')}` : c.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="px-4 py-3 border-r border-border">
                                  {c.flag_type ? (
                                    <Badge
                                      className={`text-[10px] uppercase font-bold px-1.5 h-5 ${c.flag_type === 'red-flag' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                                          c.flag_type === 'yellow-flag' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                            c.flag_type === 'black-flag' ? 'bg-gray-900 text-white dark:bg-gray-700' : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                      {c.flag_type === 'red-flag' ? '🔴 Red' : c.flag_type === 'yellow-flag' ? '🟡 Yellow' : c.flag_type === 'black-flag' ? '⚫ Black' : c.flag_type}
                                    </Badge>
                                  ) : '—'}
                                </TableCell>
                                <TableCell className="px-4 py-3 border-r border-border font-medium text-blue-600 dark:text-blue-400">{c.cin || '—'}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border font-bold text-foreground sticky left-0 bg-inherit shadow-[1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.1)]">{c.company_name}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border">{c.customer_name}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border">{c.service_area || '—'}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border">{c.contact_no_1}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border">{c.contact_no_2 || '—'}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border">
                                  <p>{c.email || '—'}</p>
                                  {c.email_2 && <p className="text-[10px] text-muted-foreground mt-0.5">{c.email_2}</p>}
                                </TableCell>

                                <TableCell className="px-4 py-3 border-r border-border max-w-[200px] truncate" title={c.tips_for_tech}>{c.tips_for_tech || '—'}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border max-w-[200px] truncate" title={c.notes}>{c.notes || '—'}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border font-bold text-emerald-600 dark:text-emerald-400">${c.payment_amount}</TableCell>
                                <TableCell className="px-4 py-3 border-r border-border font-medium uppercase text-[10px]"><Badge variant="outline">{c.payment_gateway || '—'}</Badge></TableCell>
                                <TableCell className="px-4 py-3 border-r border-border">{c.client_services || '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                        {clients.length === 0 && (
                          <TableRow><TableCell colSpan={15} className="text-center py-12 text-muted-foreground bg-muted/20">No clients found in portfolio.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeModule === 'clients' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Tabs defaultValue={searchParams.get('tab') || 'active'} className="w-full">
                <TabsList className="mb-6 flex-wrap w-full h-auto gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
                  <TabsTrigger value="active" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><Users className="h-4 w-4 mr-2" />Active Clients</TabsTrigger>
                  <TabsTrigger value="onboarding" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><UserPlus className="h-4 w-4 mr-2" />Onboarding</TabsTrigger>
                  <TabsTrigger value="flagged" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><Flag className="h-4 w-4 mr-2" />Flagged</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className={cls.page}>
                  <ActiveClientsPanel />
                </TabsContent>

                <TabsContent value="onboarding" className={cls.page}>
                  <Card>
                    <CardHeader>
                      <div className={cls.row}>
                        <div>
                          <CardTitle className={cls.inline}><UserPlus className="h-5 w-5 text-blue-500" />Clients to be Onboarded</CardTitle>
                          <CardDescription>{onboardingClients.length} clients in onboarding</CardDescription>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Search client..." value={onboardSearch} onChange={e => setOnboardSearch(e.target.value)} className="pl-9 h-9 text-sm w-[250px]" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className={cls.section}>
                      {onboardingClients.length === 0 ? (
                        <p className={`${cls.hint} text-center py-4`}>No clients currently in onboarding.</p>
                      ) : (
                        onboardingClients.filter(c => !onboardSearch || c.company_name.toLowerCase().includes(onboardSearch.toLowerCase())).map(c => (
                          <div key={c.id} className={cls.item}>
                            <div className={`${cls.row} mb-3`}>
                              <div>
                                <h4 className={cls.heading}>{c.company_name}</h4>
                                <p className={cls.hint}>Stage: {c.status}</p>
                              </div>
                              <Badge variant="outline">{c.onboarding_progress || 0}%</Badge>
                            </div>
                            <Progress value={c.onboarding_progress || 0} className="mb-3" />
                            <div className={cls.grid1}>
                              <div><p className={cls.hint}>Assigned Agent</p><p className={cls.heading}>{c.assigned_name || 'Unassigned'}</p></div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="flagged" className={cls.page}>
                  <Card>
                    <CardHeader>
                      <div className={cls.row}>
                        <div>
                          <CardTitle className={cls.inline}><Flag className="h-5 w-5 text-red-500" />Flagged Clients</CardTitle>
                          <CardDescription>Clients requiring immediate attention</CardDescription>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Search client..." value={flaggedSearch} onChange={e => setFlaggedSearch(e.target.value)} className="pl-9 h-9 text-sm w-[250px]" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className={cls.list}>
                      {flaggedClients.length === 0 ? (
                        <p className={`${cls.hint} text-center py-4`}>No flagged clients.</p>
                      ) : (
                        flaggedClients.filter(c => !flaggedSearch || c.company_name.toLowerCase().includes(flaggedSearch.toLowerCase())).map(c => (
                          <div key={c.id} className={cls.item} style={{ borderLeft: `6px solid ${FLAG_BORDER_COLORS[c.flag_type || 'flagged']}` }}>
                            <div className={`${cls.row} mb-2`}>
                              <div>
                                <h4 className={cls.heading}>{c.company_name}</h4>
                                <p className={cls.hint}>Flag Type: <span className="capitalize font-bold" style={{ color: FLAG_BORDER_COLORS[c.flag_type || 'flagged'] }}>{(c.flag_type || 'flagged').replace('-', ' ')}</span></p>
                              </div>
                              <Badge variant="destructive">FLAGGED</Badge>
                            </div>
                            <div className={cls.grid1}>
                              <div><p className={cls.hint}>Assigned Agent</p><p className={cls.heading}>{c.assigned_name || 'Unassigned'}</p></div>
                            </div>
                            <div className={`${cls.actions} mt-3 justify-end`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => unflagClient(c.id)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Unflag (Resolved)
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {activeModule === 'docs' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Tabs defaultValue="notes" className="w-full">
                <TabsList className="mb-6 flex-wrap w-full h-auto gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
                  <TabsTrigger value="notes" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><StickyNote className="h-4 w-4 mr-2" />Client Notes</TabsTrigger>
                  <TabsTrigger value="notepad" className="flex-1 rounded-lg data-[state=active]:shadow-sm"><Edit className="h-4 w-4 mr-2" />Personal Notepad</TabsTrigger>
                </TabsList>

                <TabsContent value="notes" className={cls.page}>
                  <NotesPanel />
                </TabsContent>

                <TabsContent value="notepad" className={cls.page}>
                  <Notepad />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {activeModule === 'calendar' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Card>
                <CardHeader>
                  <div className={cls.row}>
                    <div>
                      <CardTitle className={cls.inline}><Calendar className="h-5 w-5 text-blue-500" />Personal Calendar</CardTitle>
                      <CardDescription>{schedules.length} scheduled items · {formatDate(new Date().toISOString())}</CardDescription>
                    </div>
                    <Button onClick={() => openScheduleModal()} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
                      <Plus className="h-4 w-4 mr-2" />Add Entry
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {schedules.length === 0 ? (
                    <div className="text-center py-24 border-2 border-dashed rounded-xl bg-muted/5">
                      <Calendar className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                      <p className="text-muted-foreground">No schedules for today. Plan your daily tasks here.</p>
                      <Button variant="outline" className="mt-4" onClick={() => openScheduleModal()}>Create First Entry</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {schedules.map(sch => (
                        <div key={sch.id} className={`${cls.item} ${!isUpcoming(sch.start_time) ? 'opacity-60' : ''}`}>
                          <div className={`${cls.row} mb-2 flex-wrap gap-2`}>
                            <div className="flex-1 min-w-0">
                              <h4 className={cls.heading}>{sch.title}</h4>
                              {sch.description && <p className={`${cls.hint} mt-1`}>{sch.description}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={isUpcoming(sch.start_time) ? 'default' : 'secondary'}>
                                {isUpcoming(sch.start_time) ? 'Upcoming' : 'Passed'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className={cls.heading}>{formatTime(sch.start_time)} — {formatTime(sch.end_time)}</span>
                              </div>
                              <span className={cls.hint}>({getDuration(sch.start_time, sch.end_time)})</span>
                              <span className={`${cls.hintXs}`}>{formatDate(sch.start_time)}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="border-blue-500 text-blue-700 hover:bg-blue-50" onClick={() => openScheduleModal(sch)}>
                                <Edit className="h-3.5 w-3.5 mr-1" />Edit
                              </Button>
                              <Button variant="outline" size="sm" className="border-red-500 text-red-700 hover:bg-red-50" onClick={() => handleDeleteScheduleRow(sch.id)}>
                                <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeModule === 'targets' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <CSTMonthlyTargets />
            </div>
          )}

          {activeModule === 'concerns' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <InternalConcerns />
            </div>
          )}
        </div>

      </main>

      {/* Schedule Modal */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={cls.inline}>
              {editingScheduleId ? <Edit className="h-5 w-5 text-blue-500" /> : <Plus className="h-5 w-5 text-blue-500" />}
              {editingScheduleId ? 'Edit Schedule Entry' : 'Add New Schedule Entry'}
            </DialogTitle>
            <DialogDescription>Plan your daily tasks and interactions.</DialogDescription>
          </DialogHeader>
          <div className={cls.section}>
            <div className={cls.field}>
              <Label>Title *</Label>
              <Input placeholder="E.g. Morning Briefing" value={scheduleForm.title} onChange={e => setScheduleForm({ ...scheduleForm, title: e.target.value })} />
            </div>
            <div className={cls.field}>
              <Label>Description</Label>
              <Input placeholder="Optional details..." value={scheduleForm.description} onChange={e => setScheduleForm({ ...scheduleForm, description: e.target.value })} />
            </div>
            <div className={cls.grid2}>
              <div className={cls.field}>
                <Label>Start Time *</Label>
                <Input
                  type="datetime-local"
                  min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  value={scheduleForm.start_time}
                  onChange={e => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                />
              </div>
              <div className={cls.field}>
                <Label>End Time *</Label>
                <Input
                  type="datetime-local"
                  min={scheduleForm.start_time || new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  value={scheduleForm.end_time}
                  onChange={e => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleScheduleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (editingScheduleId ? 'Update Entry' : 'Save Entry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
