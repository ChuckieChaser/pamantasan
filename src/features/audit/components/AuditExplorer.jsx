// --- IMPORTS ---
import { useEffect, useMemo, useState } from 'react';
import {
    ChevronRight,
    Clock,
    Search,
    Shield,
} from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/forms/Input';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { useAudit } from '../hooks/useAudit';
import { AuditInspector } from './AuditInspector';


// --- COMPONENTS ---
export const AuditExplorer = () => {
    // --- HOOKS & STATE ---
    const { auditLogs, isLoading, handleGetAuditLogs } = useAudit();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        handleGetAuditLogs();
    }, [handleGetAuditLogs]);

    // --- DERIVED VALUES ---
    const filteredLogs = useMemo(() => {
        if (!searchQuery.trim()) return auditLogs ?? [];
        const query = searchQuery.toLowerCase().trim();
        return (auditLogs ?? []).filter((log) => {
            const event = (log.event ?? '').toLowerCase();
            const actor = `${log.actor?.givenName ?? ''} ${log.actor?.lastName ?? ''}`.toLowerCase();
            const entityId = (log.entityId ?? '').toLowerCase();
            return event.includes(query) || actor.includes(query) || entityId.includes(query);
        });
    }, [auditLogs, searchQuery]);

    // --- RENDER ---
    return (
        <div className="flex flex-col gap-5 w-full">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search audit trail by event, actor, or entity ID..."
                    leadingIcon={Search}
                    isClearable
                    onClear={() => setSearchQuery('')}
                    className="sm:w-80"
                />
            </div>

            {/* List Viewport */}
            {isLoading && (!auditLogs || auditLogs.length === 0) ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <LoadingSpinner size="lg" />
                    <span className="text-xs text-text-muted">Loading immutable audit logs...</span>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="py-16 text-center rounded-xl border border-dashed border-surface-border bg-surface/50 p-6 flex flex-col items-center justify-center gap-2">
                    <Shield className="h-8 w-8 text-text-muted opacity-50" />
                    <h3 className="text-sm font-semibold text-text">No audit entries found</h3>
                    <p className="text-xs text-text-muted max-w-sm">
                        No system operations match your current search query.
                    </p>
                </div>
            ) : (
                <>
                    {/* Mobile Card List (sm:hidden) */}
                    <div className="flex sm:hidden flex-col gap-2.5">
                        {filteredLogs.map((log) => {
                            const isSelected = selectedLog?.id === log.id;
                            const actorName = log.actor ? `${log.actor.givenName ?? ''} ${log.actor.lastName ?? ''}`.trim() : 'System';

                            return (
                                <Card
                                    key={log.id}
                                    variant="interactive"
                                    padding="sm"
                                    onClick={() => setSelectedLog(log)}
                                    className={isSelected ? 'border-accent ring-1 ring-accent' : ''}
                                >
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Badge variant="neutral" size="sm">
                                                {log.event}
                                            </Badge>
                                            <span className="text-[10px] text-text-muted flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : ''}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-surface-border text-xs text-text-muted">
                                            <div className="flex items-center gap-1.5">
                                                <Avatar src={log.actor?.avatar} size="xs" />
                                                <span className="truncate max-w-[140px] font-medium text-text">{actorName}</span>
                                            </div>

                                            <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Desktop Table View (hidden sm:block) */}
                    <div className="hidden sm:block overflow-x-auto rounded-xl border border-surface-border bg-surface shadow-xs">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-surface-border bg-surface-hover/50 text-[11px] font-semibold text-text-muted uppercase tracking-wider select-none">
                                    <th className="py-3 px-4">Event</th>
                                    <th className="py-3 px-4">Actor</th>
                                    <th className="py-3 px-4">Target Entity</th>
                                    <th className="py-3 px-4">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-border text-sm">
                                {filteredLogs.map((log) => {
                                    const isSelected = selectedLog?.id === log.id;
                                    const actorName = log.actor ? `${log.actor.givenName ?? ''} ${log.actor.lastName ?? ''}`.trim() : 'System Automated';

                                    return (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            className={`hover:bg-surface-hover/70 cursor-pointer transition-colors ${
                                                isSelected ? 'bg-accent/5' : ''
                                            }`}
                                        >
                                            <td className="py-3 px-4">
                                                <Badge variant="neutral" size="sm">
                                                    {log.event}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <Avatar src={log.actor?.avatar} size="xs" />
                                                    <span className="font-medium text-text truncate max-w-[150px]">
                                                        {actorName}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4 font-mono text-xs text-text-muted select-text">
                                                {log.entityId}
                                            </td>

                                            <td className="py-3 px-4 text-xs text-text-muted">
                                                {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Audit Inspector */}
            <AuditInspector
                log={selectedLog}
                isOpen={Boolean(selectedLog)}
                onClose={() => setSelectedLog(null)}
            />
        </div>
    );
};
