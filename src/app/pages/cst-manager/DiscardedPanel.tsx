import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Search, ShieldAlert, FlagTriangleRight, Trash2 } from 'lucide-react';
import { cls } from '../../styles/classes';
import { useClientInbox } from '../../context/ClientInboxContext';
import { useClients } from '../../context/ClientContext';
import { Button } from '../../components/ui/button';
import { apiFetch } from '../../utils/api';
import { toast } from 'sonner';

export function DiscardedPanel() {
    const { clients, updateClient, fetchData } = useClients();
    const { fetchData: fetchInbox } = useClientInbox();
    const [search, setSearch] = useState('');

    const discardedOrBlackFlagged = clients.filter(c => 
        c.status === 'discarded' || (c.status === 'flagged' && c.flag_type === 'black-flag')
    ).filter(c => !search || c.company_name.toLowerCase().includes(search.toLowerCase()));

    const handleRestore = async (id: number) => {
        try {
            // Use the specific status-toggle endpoint as general update ignores status fields
            const res = await apiFetch(`/clients/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'onboarding', flag_type: null })
            });
            
            if (res.success) {
                await fetchData(); // Refresh master list
                await fetchInbox(); // Refresh inbox
                toast.success('Client restored to inbox');
            }
        } catch (error) {
            toast.error('Failed to restore client');
        }
    };

    return (
        <div className={cls.page}>
            <Card>
                <CardHeader>
                    <div className={cls.row}>
                        <div>
                            <CardTitle className="text-red-600 flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5" />
                                Discarded & Black-Flagged Clients
                            </CardTitle>
                            <CardDescription>
                                View rejected onboarding submissions and severely flagged active clients.
                            </CardDescription>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm w-[250px]" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className={cls.list}>
                    {discardedOrBlackFlagged.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Trash2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                            <p>No discarded or black-flagged clients found.</p>
                        </div>
                    ) : (
                        discardedOrBlackFlagged.map(c => (
                            <div key={c.id} className={`${cls.itemHover} border-l-4 ${c.status === 'discarded' ? 'border-l-gray-500' : 'border-l-black'}`}>
                                <div className={`${cls.row} mb-2`}>
                                    <div className="flex items-center gap-2">
                                        <h4 className={cls.heading}>{c.company_name}</h4>
                                        {c.status === 'discarded' ? (
                                            <Badge variant="secondary" className="text-xs">Discarded</Badge>
                                        ) : (
                                            <Badge className="bg-black text-white hover:bg-black/80 text-xs">Black Flag</Badge>
                                        )}
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => handleRestore(c.id)}>
                                        Restore to Inbox
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-3">
                                    <div className="md:col-span-2">
                                        <p className={cls.hintXs}>Reason</p>
                                        <p className="font-medium text-red-700 bg-red-50 p-2 rounded mt-1 border border-red-100">
                                            {c.discard_reason || 'No reason provided.'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className={cls.hintXs}>Date</p>
                                        <p className={cls.heading}>
                                            {c.discarded_at ? new Date(c.discarded_at).toLocaleDateString() : (c.updated_at ? new Date(c.updated_at).toLocaleDateString() : 'N/A')}
                                        </p>
                                        <p className={`${cls.hintXs} mt-2`}>Assigned Agent</p>
                                        <p className={cls.heading}>{c.assigned_name || 'None'}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
