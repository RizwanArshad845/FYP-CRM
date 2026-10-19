import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Search, Clock, Trash2, ExternalLink, Pencil, Plus, Star } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { StarRating } from '../../components/shared/StarRating';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useClients } from '../../context/ClientContext';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

const OUTCOME_COLORS: Record<string, string> = {
  converted: 'bg-success-bg text-success ',
  pending: 'bg-warning-bg text-warning ',
  lost: 'bg-danger-bg text-danger ',
};

export function ImportantRecordings() {
  const { user } = useAuth();
  const { clients } = useClients();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [selectedClientId, setSelectedClientId] = useState<number>(0);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [outcome, setOutcome] = useState('pending');
  const [rating, setRating] = useState(0);

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    setIsLoading(true);
    try {
        const res = await apiFetch('/sales/important-recordings');
        if (res.success) {
            setRecordings(res.data);
        } else {
            const errorDetail = res.details || res.error || 'Unknown error';
            console.error('Recordings API Error Details:', errorDetail);
            
            if (errorDetail.includes('relation') && errorDetail.includes('does not exist')) {
                console.warn('Recordings table is still being created on server.');
            } else {
                toast.error(`Error: ${errorDetail}`);
            }
        }
    } catch (error: any) {
        console.error('Failed to fetch recordings:', error);
    } finally {
        setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setSelectedClientId(0);
    setRecordingUrl('');
    setOutcome('pending');
    setRating(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (r: any) => {
    setEditingId(r.id);
    setSelectedClientId(r.client_id);
    setRecordingUrl(r.recording_url);
    setOutcome(r.outcome);
    setRating(Number(r.quality_rating));
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this important recording?')) return;
    try {
        const res = await apiFetch(`/sales/important-recordings/${id}`, { method: 'DELETE' });
        if (res.success) {
            toast.success('Recording deleted');
            fetchRecordings();
        }
    } catch (error) {
        toast.error('Network error while deleting');
    }
  };

  const handleSubmit = async () => {
    if (!selectedClientId || !recordingUrl) {
      toast.error('Client and URL are required.');
      return;
    }
    
    setIsSubmitting(true);
    try {
        const url = editingId ? `/sales/important-recordings/${editingId}` : '/sales/important-recordings';
        const method = editingId ? 'PUT' : 'POST';
        
        const res = await apiFetch(url, {
            method,
            body: JSON.stringify({ 
                client_id: selectedClientId, 
                recording_url: recordingUrl, 
                outcome,
                quality_rating: rating,
                user_id: user?.id
            })
        });
        
        if (res.success) {
            toast.success(editingId ? 'Updated' : 'Added');
            setIsModalOpen(false);
            fetchRecordings();
        }
    } catch (error: any) {
        toast.error(error.message || 'Error saving recording');
    } finally {
        setIsSubmitting(false);
    }
  };

  const filtered = recordings.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = r.company_name?.toLowerCase().includes(term) || r.agent_name?.toLowerCase().includes(term);
    const matchesOutcome = filterOutcome === 'all' || r.outcome === filterOutcome;
    return matchesSearch && matchesOutcome;
  });

  return (
    <div className={cls.page}>
      <Card>
        <CardHeader>
          <div className={cls.row}>
            <div>
              <CardTitle>Important Call Recordings</CardTitle>
              <CardDescription>Curated high-quality sales calls and key conversations</CardDescription>
            </div>
            <Button onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-2" />Add Important Call
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by client or agent..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="pl-10" 
              />
            </div>
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

          {isLoading ? (
            <LoadingScreen fullScreen={false} message="Fetching call recordings..." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(r => (
                <Card key={r.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                  <CardContent className="pt-4 space-y-3">
                    <div className={cls.row}>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{r.company_name}</p>
                        <p className="text-xs text-muted-foreground">{r.agent_name}</p>
                      </div>
                      <Badge className={OUTCOME_COLORS[r.outcome] || 'bg-primary-soft'}>
                        {r.outcome.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>

                    {r.quality_rating > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Rating:</span>
                        <StarRating rating={Number(r.quality_rating)} />
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 text-primary border-primary/30"
                        onClick={() => window.open(r.recording_url, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-2" />Open
                      </Button>
                      {user?.id === r.user_id && (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-danger" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground italic">
                  No important recordings found.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'Add'} Important Recording</DialogTitle>
            <DialogDescription>Attach a high-value call recording link for the team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className={cls.field}>
              <Label>Select Client *</Label>
              <Select value={selectedClientId.toString()} onValueChange={v => setSelectedClientId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger>
                <SelectContent>
                  {clients?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className={cls.field}>
              <Label>Recording URL *</Label>
              <Input placeholder="Google Drive / Dropbox Link" value={recordingUrl} onChange={e => setRecordingUrl(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className={cls.field}>
                <Label>Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={cls.field}>
                <Label>Quality Rating ({rating}/5)</Label>
                <div className="flex items-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map(s => (
                        <Star 
                            key={s} 
                            className={`h-5 w-5 cursor-pointer ${s <= rating ? 'fill-warning text-warning' : 'text-muted-foreground'}`}
                            onClick={() => setRating(s)}
                        />
                    ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Recording'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
