import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { StickyNote, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export function Notepad() {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    useEffect(() => {
        if (!user) return;
        apiFetch(`/notepads?userId=${user.id}&role=${user.role}`).then(res => {
            if (res.success && res.data) {
                setContent(res.data.content || '');
            }
        }).finally(() => setIsInitialLoad(false));
    }, [user]);

    const handleSave = async () => {
        if (!user || isSaving) return;
        setIsSaving(true);
        try {
            const res = await apiFetch(`/notepads`, {
                method: 'POST',
                body: JSON.stringify({ userId: user.id, role: user.role, content })
            });
            if (res.success) {
                toast.success('Notes saved successfully!');
            } else {
                toast.error('Failed to save notes');
            }
        } catch (error) {
            toast.error('Error saving notes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!user || !confirm('Are you sure you want to clear your notes?')) return;
        try {
            const res = await apiFetch(`/notepads?userId=${user.id}&role=${user.role}`, {
                method: 'DELETE'
            });
            if (res.success) {
                setContent('');
                toast.success('Notepad cleared');
            }
        } catch (error) {
            toast.error('Failed to clear notepad');
        }
    };

    if (isInitialLoad) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading your scratchpad...</div>;

    return (
        <Card className="h-full min-h-[500px] flex flex-col shadow-lg border-2 border-warning/30 ">
            <CardHeader className="bg-warning-bg/50 border-b">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <StickyNote className="h-5 w-5 text-warning" />
                            Personal Notepad
                        </CardTitle>
                        <CardDescription>Your private scratchpad. Saves only for you.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleDelete} className="text-danger hover:text-danger hover:bg-danger-bg">
                            <Trash2 className="h-4 w-4 mr-2" /> Clear All
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-warning hover:bg-warning text-white">
                            <Save className="h-4 w-4 mr-2" /> {isSaving ? 'Saving...' : 'Save Notes'}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
                <Textarea 
                    className="w-full h-full min-h-[400px] border-none focus-visible:ring-0 resize-none p-6 font-mono text-sm bg-transparent placeholder:italic placeholder:opacity-50"
                    placeholder="Start typing your notes here...."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
            </CardContent>
            <div className="px-6 py-2 bg-warning-bg/30 text-[10px] text-muted-foreground border-t italic">
                Last auto-sync: {new Date().toLocaleTimeString()} • Only you can see these notes.
            </div>
        </Card>
    );
}
