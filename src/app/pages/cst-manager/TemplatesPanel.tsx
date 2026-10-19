import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Mail, MessageSquare, Plus, Edit, Trash2, Copy } from 'lucide-react';
import { cls } from '../../styles/classes';
import { apiFetch } from '../../utils/api';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/badge';

interface Template {
    id: number;
    title: string;
    content: string;
    type: 'email' | 'sms' | 'other';
    created_by_name: string;
    created_at: string;
}

export function TemplatesPanel() {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

    const [form, setForm] = useState({ title: '', content: '', type: 'email' });

    const fetchTemplates = async () => {
        try {
            const res = await apiFetch('/templates');
            if (res.success) setTemplates(res.data);
        } catch (err) {
            toast.error('Failed to load templates');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const openModal = (t?: Template) => {
        if (t) {
            setEditingTemplate(t);
            setForm({ title: t.title, content: t.content, type: t.type });
        } else {
            setEditingTemplate(null);
            setForm({ title: '', content: '', type: 'email' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.title || !form.content) {
            toast.error('Title and content are required');
            return;
        }

        try {
            if (editingTemplate) {
                const res = await apiFetch(`/templates/${editingTemplate.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(form)
                });
                if (res.success) {
                    toast.success('Template updated');
                    fetchTemplates();
                    setIsModalOpen(false);
                }
            } else {
                const res = await apiFetch('/templates', {
                    method: 'POST',
                    body: JSON.stringify({ ...form, created_by: user?.id })
                });
                if (res.success) {
                    toast.success('Template created');
                    fetchTemplates();
                    setIsModalOpen(false);
                }
            }
        } catch (error) {
            toast.error('Failed to save template');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this template?')) return;
        try {
            const res = await apiFetch(`/templates/${id}`, { method: 'DELETE' });
            if (res.success) {
                toast.success('Template deleted');
                fetchTemplates();
            }
        } catch (error) {
            toast.error('Failed to delete template');
        }
    };

    const copyToClipboard = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard');
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading templates...</div>;

    const emails = templates.filter(t => t.type === 'email');
    const sms = templates.filter(t => t.type === 'sms');

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className={cls.row}>
                        <div>
                            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Email & SMS Templates</CardTitle>
                            <CardDescription>Manage canned responses and outreach templates for the team.</CardDescription>
                        </div>
                        <Button onClick={() => openModal()}><Plus className="h-4 w-4 mr-2" />New Template</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    
                    {/* Emails Section */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Email Templates</h3>
                        {emails.length === 0 ? <p className={cls.hint}>No email templates found.</p> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {emails.map(t => (
                                    <div key={t.id} className="p-4 rounded-xl border bg-card hover:shadow-md transition-all flex flex-col">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold truncate" title={t.title}>{t.title}</h4>
                                            <Badge variant="outline" className="text-[10px]">Email</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1 whitespace-pre-wrap">{t.content}</p>
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t">
                                            <p className="text-[10px] text-muted-foreground">By {t.created_by_name || 'System'}</p>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => copyToClipboard(t.content)}><Copy className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => openModal(t)}><Edit className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SMS Section */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-success" />SMS / Chat Templates</h3>
                        {sms.length === 0 ? <p className={cls.hint}>No SMS templates found.</p> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sms.map(t => (
                                    <div key={t.id} className="p-4 rounded-xl border bg-card hover:shadow-md transition-all flex flex-col">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold truncate" title={t.title}>{t.title}</h4>
                                            <Badge variant="outline" className="text-[10px] bg-success-bg text-success border-success/30">SMS</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1 whitespace-pre-wrap">{t.content}</p>
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t">
                                            <p className="text-[10px] text-muted-foreground">By {t.created_by_name || 'System'}</p>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => copyToClipboard(t.content)}><Copy className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => openModal(t)}><Edit className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label>Template Name *</Label>
                                <Input placeholder="e.g. Welcome Email" value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={form.type} onValueChange={v => setForm(prev => ({ ...prev, type: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="sms">SMS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Content *</Label>
                            <Textarea 
                                placeholder="Type the template message here..." 
                                value={form.content} 
                                onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                                rows={8}
                            />
                            <p className="text-[10px] text-muted-foreground">Tip: Use placeholders like [Client Name] or [Agent Name] for easy customization later.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Template</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
