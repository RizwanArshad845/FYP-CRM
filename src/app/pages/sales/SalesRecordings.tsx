import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Search, Clock, Trash2, ExternalLink, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { StarRating } from '../../components/shared/StarRating';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { useRecordings, CallRecording } from '../../context/RecordingContext';
import { useClients } from '../../context/ClientContext';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

type RecordingStatus = 'available' | 'processing' | 'failed';

const STATUS_COLORS: Record<RecordingStatus, string> = {
  available: 'bg-success-bg text-success ',
  processing: 'bg-warning-bg text-warning ',
  failed: 'bg-danger-bg text-danger ',
};

export function SalesRecordings() {
  const { recordings, uploadRecording, updateRecording, deleteRecording, isLoading } = useRecordings();
  const { clients } = useClients();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterOutcome, setFilterOutcome] = useState('all');
  
  // Dialog form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<CallRecording | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formLink, setFormLink] = useState('');

  const agentNames = [...new Set(recordings.map(r => r.agent_name))];

  const filtered = recordings.filter(r => {
    const term = searchTerm.toLowerCase();
    return (r.client_name?.toLowerCase().includes(term) || r.agent_name?.toLowerCase().includes(term))
      && (filterAgent === 'all' || r.agent_name === filterAgent)
      && (filterOutcome === 'all' || r.outcome === filterOutcome);
  });

  const handleOpenAdd = () => {
    setEditingRecording(null);
    setSelectedClientId(0);
    setFormLink('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: CallRecording) => {
    setEditingRecording(rec);
    setSelectedClientId(rec.client_id || (rec as any).client_id);
    setFormLink(rec.recording_url);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedClientId || !formLink) {
      toast.error('Client and Google Drive Link are required.');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingRecording) {
        await updateRecording(editingRecording.id, {
          client_id: selectedClientId,
          recording_url: formLink
        });
      } else {
        await uploadRecording({
          user_id: user?.id,
          client_id: selectedClientId,
          recording_url: formLink,
          duration_seconds: 0,
          transcript: 'Google Drive Link',
          outcome: 'pending',
          quality_rating: 0,
          tags: ['drive link']
        });
      }

      setIsModalOpen(false);
      setEditingRecording(null);
      setSelectedClientId(0);
      setFormLink('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRow = async (id: number) => {
    if (confirm('Delete this recording?')) {
      await deleteRecording(id);
    }
  };

  return (
    <div className={cls.page}>
      <Card>
        <CardHeader>
          <div className={cls.row}>
            <div>
              <CardTitle>Call Recordings</CardTitle>
              <CardDescription>Link Google Drive recordings and manage previews</CardDescription>
            </div>
            <Button onClick={handleOpenAdd}>
              <ExternalLink className="h-4 w-4 mr-2" />Add Drive Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingScreen fullScreen={false} message="Retrieving Call Archives..." />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by agent or client..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger><SelectValue placeholder="Filter by agent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agentNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterOutcome} onValueChange={setFilterOutcome}>
              <SelectTrigger><SelectValue placeholder="Filter by outcome" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => {
              // Check ownership using user_id from backend or agent_id from context
              const ownerId = (r as any).user_id || r.agent_id;
              const isOwner = user?.id === ownerId;

              return (
                <Card key={r.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-4 space-y-3">
                    <div className={cls.row}>
                      <div className="flex-1">
                        <p className={`${cls.heading} mb-0.5`}>{r.client_name}</p>
                        <p className={cls.hint}>{r.agent_name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                          <Badge className={(STATUS_COLORS[r.status as RecordingStatus]) || 'bg-primary-soft'}>{r.status}</Badge>
                          {isOwner && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary-soft" onClick={() => handleOpenEdit(r)}>
                                  <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger hover:text-danger hover:bg-danger-bg" onClick={() => handleDeleteRow(r.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                      </div>
                    </div>

                    <div className={`${cls.inline} text-sm text-muted-foreground`}>
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {r.tags?.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                      {r.outcome && <Badge variant="secondary" className="text-xs uppercase">{r.outcome}</Badge>}
                    </div>

                    {r.quality_rating > 0 && (
                      <div>
                        <p className={`${cls.hintXs} mb-1`}>Quality Rating</p>
                        <StarRating rating={r.quality_rating} />
                      </div>
                    )}

                    {r.recording_url?.includes('drive.google.com') && (
                      <div className="pt-2">
                          <Button variant="outline" size="sm" className="w-full text-primary border-primary/30 hover:bg-primary-soft" onClick={() => window.open(r.recording_url, '_blank')}>
                              <ExternalLink className="h-3.5 w-3.5 mr-2" />Open in Google Drive
                          </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">No recordings found</div>
            )}
          </div>
        </>
      )}
    </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) setEditingRecording(null);
      }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingRecording ? 'Edit' : 'Add'} Google Drive Recording</DialogTitle>
                <DialogDescription>
                    Paste the shareable Google Drive link to attach it to a client.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className={cls.field}>
                    <Label>Select Client *</Label>
                    <Select value={selectedClientId.toString()} onValueChange={v => setSelectedClientId(Number(v))}>
                        <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                        <SelectContent>
                            {clients.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.company_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className={cls.field}>
                    <Label>Google Drive Link *</Label>
                    <Input placeholder="https://drive.google.com/file/d/..." value={formLink} onChange={e => setFormLink(e.target.value)} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Uploading...' : (editingRecording ? 'Save Changes' : 'Add Link')}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
