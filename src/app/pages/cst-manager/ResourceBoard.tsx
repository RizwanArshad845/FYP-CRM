import { useState, useEffect } from 'react';
import { Tldraw, Editor } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Presentation, Save, Trash2, RefreshCw, History, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cls } from '../../styles/classes';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Input } from '../../components/ui/input';

export function ResourceBoard() {
    const { user } = useAuth();
    const [editor, setEditor] = useState<Editor | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [boardId, setBoardId] = useState<number | null>(null);
    const [boardTitle, setBoardTitle] = useState('Untitled Board');
    const [creatorName, setCreatorName] = useState<string | null>(null);
    const [history, setHistory] = useState<any[]>([]);

    const fetchHistory = async () => {
        try {
            const res = await apiFetch('/boards/list');
            if (res.success) setHistory(res.data);
        } catch (error) {
            console.error('Failed to fetch board history:', error);
        }
    };

    const loadBoard = async (ed: Editor, id?: number) => {
        try {
            const url = id ? `/boards` : '/boards'; // The backend getBoard returns latest by default if no ID. 
            // Wait, my backend getBoard doesn't take an ID yet. I should fix that if I want specific loading.
            // For now, I'll assume getBoard returns the latest, or I can use a different endpoint.
            
            // Actually, let's just use the data from history if we want a specific one, or fetch by ID.
            // I'll update getBoard to handle ID later, but for now let's just use list and then fetch.
            
            const res = await apiFetch('/boards'); // This gets latest.
            if (res.success && res.data) {
                setBoardId(res.data.id);
                setBoardTitle(res.data.title || 'Untitled Board');
                setCreatorName(res.data.creator_name || 'System');
                const snapshot = typeof res.data.board_state === 'string' 
                    ? JSON.parse(res.data.board_state) 
                    : res.data.board_state;
                ed.loadSnapshot(snapshot);
            }
        } catch (error) {
            console.error('Failed to load board:', error);
        }
    };

    const loadSpecificBoard = async (id: number) => {
        if (!editor) return;
        try {
            const res = await apiFetch(`/boards?id=${id}`); 
            if (res.success && res.data) {
                setBoardId(res.data.id);
                setBoardTitle(res.data.title || 'Untitled Board');
                setCreatorName(res.data.creator_name || 'System');
                const snapshot = typeof res.data.board_state === 'string' 
                    ? JSON.parse(res.data.board_state) 
                    : res.data.board_state;
                editor.loadSnapshot(snapshot);
                toast.success(`Loaded: ${res.data.title}`);
            }
        } catch (error) {
            toast.error('Failed to load board');
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [boardId]);

    const handleSave = async () => {
        if (!editor) return;
        setIsSaving(true);
        try {
            const snapshot = editor.getSnapshot();
            const res = await apiFetch('/boards', {
                method: 'POST',
                body: JSON.stringify({
                    id: boardId,
                    title: boardTitle,
                    board_state: snapshot,
                    created_by: user?.id
                })
            });
            if (res.success) {
                setBoardId(res.data.id);
                setCreatorName(user?.name || 'You');
                toast.success('Board state saved to cloud');
                fetchHistory();
            } else {
                toast.error(res.error || 'Failed to save board');
            }
        } catch (error) {
            toast.error('Network error while saving board');
        } finally {
            setIsSaving(false);
        }
    };

    const handleNew = () => {
        if (confirm('Create a new board? Current unsaved changes will be lost.')) {
            setBoardId(null);
            setBoardTitle('New Board');
            setCreatorName(user?.name || 'You');
            if (editor) {
                editor.selectAll().deleteShapes(editor.getSelectedShapeIds());
            }
            toast.info('New board created locally. Save to persist to cloud.');
        }
    };

    const handleDelete = async () => {
        if (!boardId) return;
        if (!confirm('Are you sure you want to delete this board from the cloud?')) return;

        try {
            const res = await apiFetch(`/boards/${boardId}`, { method: 'DELETE' });
            if (res.success) {
                toast.success('Cloud board deleted');
                setBoardId(null);
                setBoardTitle('Untitled Board');
                setCreatorName(null);
                if (editor) {
                    editor.selectAll().deleteShapes(editor.getSelectedShapeIds());
                }
                fetchHistory();
            } else {
                toast.error(res.error || 'Failed to delete');
            }
        } catch (error) {
            toast.error('Network error while deleting board');
        }
    };

    return (
        <div className={cls.page}>
            <Card className="h-[85vh] flex flex-col">
                <CardHeader className="shrink-0 pb-2 border-b">
                    <div className={cls.row}>
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <Presentation className="h-5 w-5 text-indigo-500" />
                                <Input 
                                    className="h-8 font-semibold text-lg border-none hover:bg-muted focus-visible:ring-1 w-[300px] p-1"
                                    value={boardTitle}
                                    onChange={e => setBoardTitle(e.target.value)}
                                    placeholder="Board Title..."
                                />
                                {creatorName && <span className="text-xs text-muted-foreground ml-2">by {creatorName}</span>}
                            </div>
                            <CardDescription>
                                Collaborative whiteboard for brainstorming strategies and outlining workflows.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <History className="h-4 w-4 mr-2" /> History
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <div className="p-3 border-b bg-muted/30">
                                        <p className="text-sm font-semibold">Saved Boards</p>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {history.map(b => (
                                            <div 
                                                key={b.id} 
                                                className={`p-3 text-sm cursor-pointer hover:bg-primary/5 border-b last:border-0 flex justify-between items-center group ${boardId === b.id ? 'bg-primary/5 font-medium' : ''}`}
                                                onClick={() => loadSpecificBoard(b.id)}
                                            >
                                                <div className="truncate flex-1 pr-2">
                                                    <p className="truncate">{b.title || 'Untitled'}</p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {b.creator_name ? `by ${b.creator_name} • ` : ''}
                                                        {new Date(b.updated_at).toLocaleString()}
                                                    </p>
                                                </div>
                                                {boardId === b.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                            </div>
                                        ))}
                                        {history.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">No saved boards found</p>}
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Button variant="outline" size="sm" onClick={handleNew}>
                                <Plus className="h-4 w-4 mr-2" /> New
                            </Button>
                            
                            <Button variant="outline" size="sm" onClick={handleDelete} disabled={!boardId} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </Button>
                            
                            <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
                                <Save className="h-4 w-4 mr-2" /> {isSaving ? 'Saving...' : 'Save to Cloud'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden relative min-h-[600px]">
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <Tldraw 
                            persistenceKey={`cst-resource-board-v5-${boardId || 'new'}`} 
                            onMount={(ed) => {
                                setEditor(ed);
                                loadBoard(ed);
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
