import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { TrendingUp, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { cls } from '../../styles/classes';
import { apiFetch } from '../../utils/api';
import { toast } from 'sonner';
import { LoadingScreen } from '../../components/shared/LoadingScreen';

interface AgentPerformanceMetrics {
    target_id: number;
    agent_id: number;
    first_name: string;
    last_name: string;
    user_status: string;
    target_month: string;
    total_target: number;
    total_achieved: number;
}

function formatCurrency(amount: number) {
    return `$ ${(amount || 0).toLocaleString()}`;
}

function calcPercentage(achieved: number, target: number) {
    if (!target) return 0;
    return Math.round((achieved / target) * 100);
}

function percentageColor(pct: number) {
    if (pct >= 100) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (pct >= 75) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
}

function renderAchievementBadge(pct: number, index: number) {
    // Top 3 Leader badges
    if (pct > 0) {
        if (index === 0) {
            return (
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-white font-bold shadow-sm animate-pulse border-none">
                    🏆 1st Leader
                </Badge>
            );
        }
        if (index === 1) {
            return (
                <Badge className="bg-gradient-to-r from-slate-400 to-slate-300 hover:from-slate-500 hover:to-slate-400 text-white font-bold shadow-sm border-none">
                    🥈 2nd Place
                </Badge>
            );
        }
        if (index === 2) {
            return (
                <Badge className="bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-800 hover:to-amber-700 text-white font-bold shadow-sm border-none">
                    🥉 3rd Place
                </Badge>
            );
        }
    }

    // Goal percentage status badges
    if (pct >= 100) {
        return (
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none">
                🎯 Target Met
            </Badge>
        );
    }
    if (pct >= 75) {
        return (
            <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-semibold border-none">
                🚀 High Flyer
            </Badge>
        );
    }
    if (pct >= 50) {
        return (
            <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold border-none">
                📈 On Track
            </Badge>
        );
    }
    if (pct > 0) {
        return (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50/50 font-medium">
                ⭐ Contributor
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 font-normal">
            ⏳ Not Started
        </Badge>
    );
}

export function TeamPerformance() {
    const [agents, setAgents] = useState<AgentPerformanceMetrics[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterMonth, setFilterMonth] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/sales-manager/agent-performance');
            if (res.success && Array.isArray(res.data)) {
                setAgents(res.data.map((a: any) => ({
                    target_id: Number(a.target_id),
                    agent_id: Number(a.agent_id),
                    first_name: a.first_name || '',
                    last_name: a.last_name || '',
                    user_status: a.user_status || 'active',
                    target_month: a.target_month || '',
                    total_target: Number(a.total_target) || 0,
                    total_achieved: Number(a.total_achieved) || 0
                })));
            }
        } catch (error) {
            console.error('Failed to fetch team performance:', error);
            toast.error('Failed to load team performance data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const formatTargetMonth = (dateStr: string) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    // Extract unique months for the filter
    const uniqueMonths = Array.from(new Set(agents.map(a => a.target_month))).sort().reverse();

    let list = [...agents];
    
    // Filter by month
    if (filterMonth !== 'all') {
        list = list.filter(a => a.target_month === filterMonth);
    }
    
    // Filter by search query
    if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        list = list.filter(a => 
            a.first_name.toLowerCase().includes(q) || 
            a.last_name.toLowerCase().includes(q)
        );
    }
    
    // REQUIREMENT: Sort by total achieved descending (highest target achieved at the top)
    list.sort((a, b) => b.total_achieved - a.total_achieved);

    return (
        <div className={cls.page}>
            <Card>
                <CardHeader>
                    <div className={cls.row}>
                        <div>
                            <CardTitle>Team Performance Leaderboard</CardTitle>
                            <CardDescription>View targets and achievements across the sales team, sorted by highest revenue achieved</CardDescription>
                        </div>
                        <div>
                            <Button variant="outline" size="sm" onClick={() => fetchData()}>
                                <TrendingUp className="h-4 w-4 mr-2" />Refresh Leaderboard
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="relative mt-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search agents..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                className="pl-10" 
                            />
                        </div>
                        <div className="flex-1">
                            <label className={`${cls.label} mb-2 block`}>Filter by Month</label>
                            <Select value={filterMonth} onValueChange={setFilterMonth}>
                                <SelectTrigger><SelectValue placeholder="All Months" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Months</SelectItem>
                                    {uniqueMonths.map(m => (
                                        <SelectItem key={m} value={m}>{formatTargetMonth(m)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {isLoading ? (
                        <LoadingScreen fullScreen={false} message="Loading Leaderboard..." />
                    ) : list.length === 0 ? (
                        <div className="text-center py-20">
                            <p className={cls.hint}>No team performance data found.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table view of dynamic stats */}
                            <div className="hidden lg:block overflow-x-auto">
                                <Table className="w-full text-sm">
                                    <TableHeader className="bg-muted/50 border-b">
                                        <TableRow>
                                            {['Agent Name', 'Month', 'Status', 'Targets', 'Achieved', 'Goal %'].map(h => (
                                                <TableHead key={h} className={cls.tableHead}>{h}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="divide-y">
                                        {list.map((agent, idx) => {
                                            const pct = calcPercentage(agent.total_achieved, agent.total_target);
                                            return (
                                                <TableRow key={`${agent.agent_id}-${idx}`} className={cls.tableRow}>
                                                    <TableCell className={cls.tableCell}>
                                                        <div className={cls.inline}>
                                                            <div className={cls.avatar}>
                                                                <span className={cls.avatarText}>
                                                                    {agent.first_name[0] || ''}{agent.last_name[0] || ''}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={cls.heading}>{agent.first_name} {agent.last_name}</span>
                                                                <div className="flex gap-1 mt-1">
                                                                    {renderAchievementBadge(pct, idx)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={cls.tableCell}>
                                                        <span className="font-medium">{formatTargetMonth(agent.target_month)}</span>
                                                    </TableCell>
                                                    <TableCell className={cls.tableCell}>
                                                        <Badge variant={agent.user_status === 'active' ? 'default' : 'secondary'}>
                                                            {agent.user_status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className={`${cls.tableCell} font-mono font-medium`}>
                                                        {formatCurrency(agent.total_target)}
                                                    </TableCell>
                                                    <TableCell className={`${cls.tableCell} font-mono font-bold text-green-600`}>
                                                        {formatCurrency(agent.total_achieved)}
                                                    </TableCell>
                                                    <TableCell className={cls.tableCell}>
                                                        <div className={`px-2 py-1 rounded-md inline-flex font-bold text-sm items-center ${percentageColor(pct)}`}>
                                                            <TrendingUp className="w-3.5 h-3.5 mr-1" />
                                                            {pct}%
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Cards View */}
                            <div className="lg:hidden space-y-4">
                                {list.map((agent, idx) => {
                                    const pct = calcPercentage(agent.total_achieved, agent.total_target);
                                    return (
                                        <Card key={`${agent.agent_id}-${idx}`}>
                                            <CardHeader className="pb-2">
                                                <div className={cls.row}>
                                                    <div className={cls.inline}>
                                                        <div className={cls.avatar}>
                                                            <span className={cls.avatarText}>
                                                                {agent.first_name[0] || ''}{agent.last_name[0] || ''}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <h4 className={cls.heading}>{agent.first_name} {agent.last_name}</h4>
                                                            <div className="flex flex-wrap gap-2 items-center mt-1">
                                                                <Badge variant={agent.user_status === 'active' ? 'default' : 'secondary'}>
                                                                    {agent.user_status}
                                                                </Badge>
                                                                {renderAchievementBadge(pct, idx)}
                                                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                                                                    {formatTargetMonth(agent.target_month)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={`px-2 py-1 rounded-md font-bold text-sm ${percentageColor(pct)}`}>
                                                        {pct}%
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-2">
                                                <div className={cls.grid2}>
                                                    <div>
                                                        <p className={`${cls.hint} mb-1`}>Targets</p>
                                                        <p className={`${cls.heading} font-mono`}>{formatCurrency(agent.total_target)}</p>
                                                    </div>
                                                    <div>
                                                        <p className={`${cls.hint} mb-1`}>Achieved</p>
                                                        <p className={`${cls.heading} font-mono text-green-600`}>{formatCurrency(agent.total_achieved)}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
