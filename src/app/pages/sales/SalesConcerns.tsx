import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Edit, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

export function SalesConcerns() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [type, setType] = useState('Payment Issue');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchConcerns();
  }, []);

  const fetchConcerns = async () => {
    setLoading(true);
    const res = await apiFetch('/concerns');
    if (res.success) {
      setConcerns(res.data.filter((c: any) => c.raised_by === user?.id));
    }
    setLoading(false);
  };

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    setType(c.concern_type);
    setDescription(c.description);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setType('Payment Issue');
    setDescription('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this concern?')) return;
    const res = await apiFetch(`/concerns/${id}`, { method: 'DELETE' });
    if (res.success) {
      toast.success('Concern deleted');
      fetchConcerns();
    } else {
      toast.error('Failed to delete concern');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setIsSubmitting(true);
    
    const url = editingId ? `/concerns/${editingId}` : '/concerns';
    const method = editingId ? 'PUT' : 'POST';
    
    const res = await apiFetch(url, {
      method,
      body: JSON.stringify({ concern_type: type, description, raised_by: user?.id })
    });
    
    setIsSubmitting(false);
    if (res.success) {
      toast.success(editingId ? 'Concern updated' : 'Concern submitted');
      setDescription('');
      setEditingId(null);
      fetchConcerns();
    } else {
      toast.error(editingId ? 'Failed to update concern' : 'Failed to submit concern');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className={editingId ? 'border-primary ring-1 ring-primary' : ''}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{editingId ? 'Edit Concern' : 'Raise a New Concern'}</CardTitle>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="h-4 w-4 mr-2" /> Cancel Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Concern Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Payment Issue">Payment Issue</SelectItem>
                    <SelectItem value="Client Unresponsive">Client Unresponsive</SelectItem>
                    <SelectItem value="Technical Request">Technical Request</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                placeholder="Describe the concern..." 
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
              />
            </div>
            <Button type="submit" disabled={isSubmitting || !description.trim()}>
              {isSubmitting ? 'Saving...' : (editingId ? 'Update Concern' : 'Submit Concern')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Raised Concerns</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center animate-pulse">Loading...</TableCell></TableRow>
              ) : concerns.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No concerns found.</TableCell></TableRow>
              ) : (
                concerns.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{c.concern_type}</TableCell>
                    <TableCell className="max-w-[300px] truncate" title={c.description}>{c.description}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        c.status === 'open' ? 'bg-warning-bg text-warning' :
                        c.status === 'in-progress' ? 'bg-primary-soft text-primary' :
                        'bg-success-bg text-success'
                      }`}>
                        {c.status.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(c)}
                          disabled={c.status !== 'open'}
                          title={c.status !== 'open' ? "Cannot edit concerns that are already being processed" : "Edit Concern"}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(c.id)}
                          className="text-danger hover:text-danger hover:bg-danger-bg"
                          title="Delete Concern"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
