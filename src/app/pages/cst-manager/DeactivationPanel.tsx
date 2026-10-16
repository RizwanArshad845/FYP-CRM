import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { AlertTriangle, CheckCircle2, XCircle, Clock, User, Building2 } from 'lucide-react';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { useClients } from '../../context/ClientContext';

export function DeactivationPanel() {
    const { deactivationRequests, resolveDeactivationRequest } = useClients();

    return (
        <div className={cls.page}>
            {/* Header stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                <Card className="border-yellow-300/50 dark:border-yellow-700/50 bg-yellow-50/30 dark:bg-yellow-950/20">
                    <CardContent className="pt-5 pb-4 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{deactivationRequests.length}</p>
                            <p className="text-xs text-muted-foreground">Pending Requests</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Requests */}
            {deactivationRequests.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-400 opacity-60" />
                        <h3 className="text-lg font-semibold text-foreground mb-1">All Clear!</h3>
                        <p className="text-sm text-muted-foreground">No pending deactivation requests from CST agents.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-yellow-200 dark:border-yellow-800/50">
                    <CardHeader>
                        <CardTitle className={`${cls.inline} text-yellow-700 dark:text-yellow-400`}>
                            <AlertTriangle className="h-5 w-5" />
                            Pending Deactivation Requests
                        </CardTitle>
                        <CardDescription>CST agents have requested the following clients be deactivated — review and approve or dismiss each one.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {deactivationRequests.map(req => (
                                <div
                                    key={req.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800/40 bg-yellow-50/40 dark:bg-yellow-950/20 transition-all hover:shadow-md"
                                >
                                    {/* Client info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <p className="font-semibold text-foreground truncate">{req.client_name}</p>
                                            <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 text-[10px] uppercase tracking-wider shrink-0">
                                                Pending
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                Requested by <strong className="text-foreground">{req.requested_by}</strong>
                                            </span>
                                            <span>
                                                {new Date(req.created_at).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="gap-1.5"
                                            onClick={() => {
                                                resolveDeactivationRequest(req.id, true, req.client_id);
                                                toast.success(`"${req.client_name}" has been deactivated.`);
                                            }}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Approve & Deactivate
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5"
                                            onClick={() => {
                                                resolveDeactivationRequest(req.id, false, req.client_id);
                                                toast.info(`Request for "${req.client_name}" dismissed.`);
                                            }}
                                        >
                                            <XCircle className="h-3.5 w-3.5" />
                                            Dismiss
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
