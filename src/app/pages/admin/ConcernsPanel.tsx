import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { AlertCircle, CheckCircle2, Clock, Trash2, User } from 'lucide-react';
import { cls } from '../../styles/classes';
import { useConcerns, Concern } from '../../context/ConcernContext';

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-warning-bg text-warning border-warning/30',
    open: 'bg-warning-bg text-warning border-warning/30',
    'in-progress': 'bg-primary-soft text-primary border-primary/30',
    resolved: 'bg-success-bg text-success border-success/30'
};

export function ConcernsPanel() {
    const { externalConcerns, internalConcerns, isLoading, updateStatus, deleteConcern } = useConcerns();

    const handleUpdateStatus = async (id: number, status: string, isInternal: boolean) => {
        await updateStatus(id, status, isInternal);
    };

    const handleDelete = async (id: number, isInternal: boolean) => {
        if (!confirm('Are you sure you want to delete this concern?')) return;
        await deleteConcern(id, isInternal);
    };

    const ConcernList = ({ concerns, isInternal }: { concerns: Concern[], isInternal: boolean }) => (
        <div className="space-y-4">
            {concerns.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground italic">No concerns reported.</p>
            ) : (
                concerns.map(c => (
                    <Card key={c.id} className="border-l-4 border-l-amber-500">
                        <CardHeader className="pb-2">
                            <div className={cls.row}>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">{c.concern_type.toUpperCase()}</Badge>
                                    <Badge className={STATUS_COLORS[c.status]}>{c.status.toUpperCase()}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm mb-4 whitespace-pre-wrap">{c.description}</p>
                            <div className="flex items-center justify-between border-t pt-4">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> Raised by: {c.raised_by_name}</span>
                                    {!isInternal && c.assigned_to_name && (
                                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Assigned: {c.assigned_to_name}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={c.status} onValueChange={(v) => handleUpdateStatus(c.id, v, isInternal)}>
                                        <SelectTrigger className="h-8 w-32 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="open">Open / New</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="in-progress">In Progress</SelectItem>
                                            <SelectItem value="resolved">Resolved</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => handleDelete(c.id, isInternal)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    );

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading concerns...</div>;

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-warning" />Concerns Management</CardTitle>
                <CardDescription>Track and resolve operational issues and client concerns.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="external" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="external">External / Client</TabsTrigger>
                        <TabsTrigger value="internal">Internal Operational</TabsTrigger>
                    </TabsList>
                    <TabsContent value="external">
                        <ConcernList concerns={externalConcerns} isInternal={false} />
                    </TabsContent>
                    <TabsContent value="internal">
                        <ConcernList concerns={internalConcerns} isInternal={true} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
