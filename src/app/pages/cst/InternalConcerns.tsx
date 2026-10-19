import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { AlertCircle, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

export function InternalConcerns() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [concernType, setConcernType] = useState('Tech Team');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchConcerns();
  }, []);

  const fetchConcerns = async () => {
    setIsLoading(true);
    try {
        const res = await apiFetch(`/concerns/internal?userId=${user?.id}`);
        console.log('[DEBUG] Internal Concerns API Response:', res);
        if (res.success) {
            setConcerns(res.data || []);
            console.log('[DEBUG] Set concerns state to:', res.data);
        } else {
            toast.error(res.error || 'Failed to fetch concerns');
        }
    } catch (error: any) {
        console.error('Failed to fetch concerns:', error);
        toast.error('Connection error: could not load concerns');
    } finally {
        setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setConcernType('Tech Team');
    setDescription('');
    setIsEditMode(false);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: any) => {
    setConcernType(c.concern_type);
    setDescription(c.description);
    setIsEditMode(true);
    setEditingId(c.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this concern?')) return;
    
    try {
        const res = await apiFetch(`/concerns/internal/${id}`, {
            method: 'DELETE'
        });
        if (res.success) {
            toast.success('Concern deleted successfully');
            fetchConcerns();
        } else {
            toast.error(res.error || 'Failed to delete concern');
        }
    } catch (error) {
        toast.error('Error deleting concern');
    }
  };

  const handleSubmit = async () => {
    if (!description) {
      toast.error('Description is required.');
      return;
    }
    
    setIsSubmitting(true);
    try {
        const url = isEditMode ? `/concerns/internal/${editingId}` : '/concerns/internal';
        const method = isEditMode ? 'PUT' : 'POST';
        
        const res = await apiFetch(url, {
            method,
            body: JSON.stringify({ 
                concern_type: concernType, 
                description,
                raised_by: user?.id 
            })
        });
        
        if (res.success) {
            toast.success(isEditMode ? 'Concern updated' : 'Internal concern raised successfully');
            setIsModalOpen(false);
            fetchConcerns();
        } else {
            toast.error(res.error || 'Failed to process concern');
        }
    } catch (error: any) {
        console.error('Submit concern error:', error);
        toast.error(error.message || 'Network error while submitting concern');
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredConcerns = concerns.filter(c => 
    c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.concern_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.raised_by_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={cls.page}>
      <Card>
        <CardHeader>
          <div className={cls.row}>
            <div>
              <CardTitle>Internal CST Concerns</CardTitle>
              <CardDescription>Raise and track issues regarding Tech Team, Clients, or Others</CardDescription>
            </div>
            <Button onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-2" />Raise Concern
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative w-full md:w-1/3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search concerns..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>

          {isLoading ? (
            <LoadingScreen fullScreen={false} message="Loading concerns..." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Raised</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Raised By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConcerns.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No internal concerns found.</TableCell></TableRow>
                  )}
                  {filteredConcerns.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.concern_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate" title={c.description}>{c.description}</TableCell>
                      <TableCell>{c.raised_by_name}</TableCell>
                      <TableCell>
                        <Badge className={
                          c.status === 'resolved' ? 'bg-success-bg text-success' :
                          c.status === 'in-progress' ? 'bg-primary-soft text-primary' :
                          'bg-warning-bg text-warning'
                        }>
                          {c.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${c.status.toLowerCase() === 'open' ? 'text-primary hover:text-primary hover:bg-primary-soft' : 'text-muted-foreground cursor-not-allowed'}`}
                            onClick={() => c.status.toLowerCase() === 'open' && handleOpenEdit(c)}
                            title={c.status.toLowerCase() === 'open' ? 'Edit' : 'Cannot edit (Admin viewed or processing)'}
                            disabled={c.status.toLowerCase() !== 'open'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${c.status.toLowerCase() === 'open' ? 'text-danger hover:text-danger hover:bg-danger-bg' : 'text-muted-foreground cursor-not-allowed'}`}
                            onClick={() => c.status.toLowerCase() === 'open' && handleDelete(c.id)}
                            title={c.status.toLowerCase() === 'open' ? 'Delete' : 'Cannot delete (Admin viewed or processing)'}
                            disabled={c.status.toLowerCase() !== 'open'}
                          >
                            <Trash2 className="h-4 w-4" />
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Internal Concern' : 'Raise Internal Concern'}</DialogTitle>
            <DialogDescription>{isEditMode ? 'Update the details of this concern.' : 'Submit an internal issue for the team to review.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className={cls.field}>
              <Label>Concern Type *</Label>
              <Select value={concernType} onValueChange={setConcernType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tech Team">Tech Team</SelectItem>
                  <SelectItem value="Client">Client</SelectItem>
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cls.field}>
              <Label>Description *</Label>
              <Textarea 
                placeholder="Describe the issue in detail..." 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : (isEditMode ? 'Save Changes' : 'Submit Concern')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
