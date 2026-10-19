import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cls } from '../../styles/classes';
import { useCSTManagerTasks, type CSTTaskStatus, type CSTTaskPriority } from '../../context/CSTManagerTaskContext';

function priorityBadge(priority: CSTTaskPriority) {
    switch (priority) {
        case 'high':   return 'bg-danger-bg text-danger border-danger-border';
        case 'medium': return 'bg-warning-bg text-warning border-warning/30';
        case 'low':    return 'bg-primary-soft text-primary border-primary/30';
        default:       return 'bg-muted text-foreground border-border';
    }
}

function statusBadge(status: CSTTaskStatus) {
    switch (status) {
        case 'completed':   return 'bg-success-bg text-success border-success/30';
        case 'in-progress': return 'bg-primary-soft text-primary border-primary/30';
        case 'missed':      return 'bg-danger-bg text-danger border-danger-border';
        default:            return 'bg-muted text-foreground border-border'; // pending
    }
}

export function TasksPanel() {
    const { tasks, updateTaskStatus, loading } = useCSTManagerTasks();
    const [search, setSearch] = useState('');

    const filteredTasks = tasks.filter(t => 
        !search || 
        t.title.toLowerCase().includes(search.toLowerCase()) || 
        t.category.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading assigned tasks...</div>;

    return (
        <div className={cls.page}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground ">Tasks from Admin</h2>
                <Badge variant="outline" className="font-mono">{filteredTasks.length} total</Badge>
                
                <div className="relative ml-auto w-full sm:w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search tasks..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        className="pl-9 h-9 text-sm" 
                    />
                </div>
            </div>

            {filteredTasks.length === 0 ? (
                <div className="text-center py-16 bg-muted rounded-xl border-2 border-dashed border-border ">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-20" />
                    <p className="text-muted-foreground font-medium italic">No pending tasks from Admin.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredTasks.map(task => (
                        <div 
                            key={task.id} 
                            className={`p-4 rounded-xl border-2 transition-all hover:shadow-md bg-white ${
                                task.priority === 'high' ? 'border-l-4 border-l-red-500 border-danger-border' : 'border-border '
                            }`}
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-foreground dark:text-white">{task.title}</h3>
                                        <Badge className={`text-[10px] uppercase font-bold border ${priorityBadge(task.priority)}`}>
                                            {task.priority}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {task.notes || 'No additional instructions provided.'}
                                    </p>
                                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <Clock className="h-3.5 w-3.5 mr-1" />
                                            Due: <span className="ml-1 font-semibold text-muted-foreground ">{task.dueDate}</span>
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] bg-muted ">
                                            {task.category}
                                        </Badge>
                                        <Badge className={`text-[10px] border ${statusBadge(task.status)}`}>
                                            {task.status.replace('-', ' ')}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 min-w-fit">
                                    {task.status !== 'completed' && (
                                        <>
                                            {task.status !== 'in-progress' && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="h-8 text-xs border-primary/30 text-primary hover:bg-primary-soft"
                                                    onClick={() => updateTaskStatus(task.id, 'in-progress')}
                                                >
                                                    Start Task
                                                </Button>
                                            )}
                                            <Button 
                                                size="sm" 
                                                className="h-8 text-xs bg-success hover:bg-success text-white"
                                                onClick={() => updateTaskStatus(task.id, 'completed')}
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                Complete
                                            </Button>
                                        </>
                                    )}
                                    {task.status === 'completed' && (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center text-success font-bold text-xs py-1 px-3 bg-success-bg rounded-full">
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                Done
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 text-[10px] text-muted-foreground hover:text-muted-foreground underline"
                                                onClick={() => updateTaskStatus(task.id, 'in-progress')}
                                            >
                                                Revert to Pending
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
