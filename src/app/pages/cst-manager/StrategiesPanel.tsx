import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { BookOpen, Trash2, Save } from 'lucide-react';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { useClientInbox, type ClientStrategy } from '../../context/ClientInboxContext';

export function StrategiesPanel() {
    const { inboxClients, strategies, updateStrategy, deleteStrategy } = useClientInbox();
    const allClients = inboxClients;

    const [expanded, setExpanded] = useState<number | null>(null);
    const [drafts, setDrafts] = useState<Record<number, string>>({});

    const getStrategy = (clientId: number): ClientStrategy =>
        strategies.find(s => s.client_id === clientId) ?? { client_id: clientId, strategy_text: '', created_at: '' };

    const getDraft = (id: number) => drafts[id] ?? getStrategy(id).strategy_text;
    const setDraft = (id: number, v: string) =>
        setDrafts(prev => ({ ...prev, [id]: v }));

    const handleSave = (clientId: number) => {
        const text = getDraft(clientId);
        updateStrategy(clientId, text);
        toast.success('Strategy saved!');
    };

    return (
        <div className={cls.page}>
            <div className="flex items-center gap-2 mb-2">
                <h2 className="text-lg font-semibold">Client Strategies</h2>
                <Badge variant="outline">{allClients.length} clients</Badge>
            </div>

            {allClients.length === 0 ? (
                <p className={`${cls.hint} py-8 text-center`}>No clients found.</p>
            ) : (
                allClients.map(client => {
                    const strat = getStrategy(client.id);
                    const isOpen = expanded === client.id;
                    const draft = getDraft(client.id);

                    return (
                        <Card key={client.id} className="border-2 mb-4">
                            <CardHeader
                                className="cursor-pointer select-none pb-3"
                                onClick={() => setExpanded(isOpen ? null : client.id)}
                            >
                                <div className={cls.row}>
                                    <div className={cls.inline}>
                                        <BookOpen className="h-4 w-4 text-primary" />
                                        <div>
                                            <CardTitle className="text-base">{client.company_name}</CardTitle>
                                            <CardDescription>Agent: {client.assigned_name || 'Unassigned'} · {client.product_sold}</CardDescription>
                                        </div>
                                    </div>
                                    <div className={cls.inline}>
                                        {strat.created_at && <span className={cls.hintXs}>Updated {new Date(strat.created_at).toLocaleDateString()}</span>}
                                        <Badge variant={strat.strategy_text ? 'default' : 'outline'} className="text-xs">
                                            {strat.strategy_text ? 'Strategy set' : 'No strategy'}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>

                            {isOpen && (
                                <CardContent className={cls.section}>
                                    <div className={cls.field}>
                                        <Label>Strategic Onboarding Plan</Label>
                                        <Textarea
                                            rows={6}
                                            placeholder="Outline the technical strategy, key milestones, and action items for this client..."
                                            value={draft}
                                            onChange={e => setDraft(client.id, e.target.value)}
                                            className="mt-2"
                                        />
                                        <div className="flex gap-2 mt-4">
                                            <Button size="sm" onClick={() => handleSave(client.id)}>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Strategy
                                            </Button>
                                            {strat.strategy_text && (
                                                <Button size="icon" variant="destructive" title="Delete Strategy" onClick={() => {
                                                    if (confirm('Are you sure you want to delete this strategy?')) {
                                                        deleteStrategy(client.id);
                                                        setDraft(client.id, '');
                                                        toast.success('Strategy deleted!');
                                                    }
                                                }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {(client.client_concerns || client.tips_for_tech) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                            {client.client_concerns && (
                                                <div className={`${cls.muted} text-sm`}>
                                                    <p className={`${cls.hintXs} mb-1`}>Client Concerns (from Sales)</p>
                                                    <p>{client.client_concerns}</p>
                                                </div>
                                            )}
                                            {client.tips_for_tech && (
                                                <div className={`${cls.muted} bg-blue-50 text-sm`}>
                                                    <p className={`${cls.hintXs} mb-1`}>Tips for Tech (from Sales)</p>
                                                    <p>{client.tips_for_tech}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    );
                })
            )}
        </div>
    );
}
