import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cls } from '../../styles/classes';
import { useCSTManagerTasks, type CSTTaskStatus, type CSTTaskPriority } from '../../context/CSTManagerTaskContext';

function priorityBadge(priority: CSTTaskPriority) {
    switch (priority) {
        case 'high':   return 'bg-red-100 text-red-700 border-red-200';
        case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        case 'low':    return 'bg-blue-100 text-blue-700 border-blue-200';
        default:       return 'bg-gray-100 text-gray-700 border-gray-200';
    }
}

function statusBadge(status: CSTTaskStatus) {
    switch (status) {
        case 'completed':   return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'in-progress': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'missed':      return 'bg-red-100 text-red-700 border-red-200';
        default:            return 'bg-slate-100 text-slate-700 border-slate-200'; // pending
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
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Tasks from Admin</h2>
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
                <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-slate-300 mb-3 opacity-20" />
                    <p className="text-slate-500 font-medium italic">No pending tasks from Admin.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredTasks.map(task => (
                        <div 
                            key={task.id} 
                            className={`p-4 rounded-xl border-2 transition-all hover:shadow-md bg-white dark:bg-slate-900 ${
                                task.priority === 'high' ? 'border-l-4 border-l-red-500 border-red-50' : 'border-slate-100 dark:border-slate-800'
                            }`}
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-800 dark:text-white">{task.title}</h3>
                                        <Badge className={`text-[10px] uppercase font-bold border ${priorityBadge(task.priority)}`}>
                                            {task.priority}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {task.notes || 'No additional instructions provided.'}
                                    </p>
                                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                                        <div className="flex items-center text-xs text-slate-400">
                                            <Clock className="h-3.5 w-3.5 mr-1" />
                                            Due: <span className="ml-1 font-semibold text-slate-600 dark:text-slate-300">{task.dueDate}</span>
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-slate-800">
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
                                                    className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                                    onClick={() => updateTaskStatus(task.id, 'in-progress')}
                                                >
                                                    Start Task
                                                </Button>
                                            )}
                                            <Button 
                                                size="sm" 
                                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={() => updateTaskStatus(task.id, 'completed')}
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                Complete
                                            </Button>
                                        </>
                                    )}
                                    {task.status === 'completed' && (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center text-emerald-600 font-bold text-xs py-1 px-3 bg-emerald-50 rounded-full">
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                Done
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-6 text-[10px] text-slate-400 hover:text-slate-600 underline"
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
