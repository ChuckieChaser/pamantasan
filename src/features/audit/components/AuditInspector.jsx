// --- IMPORTS ---
import { Calendar, Hash, Layers, Shield, User } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Panel } from '../../../components/layout/Panel';


// --- COMPONENTS ---
export const AuditInspector = ({
    log = null,
    isOpen = false,
    onClose,
}) => {
    // Guard: Hidden if no log or not open
    if (!isOpen || !log) {
        return null;
    }

    // --- DERIVED VALUES ---
    const actorName = log.actor ? `${log.actor.givenName ?? ''} ${log.actor.lastName ?? ''}`.trim() : 'System Automated';
    let formattedData = log.data;
    try {
        const parsed = JSON.parse(log.data);
        formattedData = JSON.stringify(parsed, null, 2);
    } catch {
        // Leave as string if not JSON
    }

    // --- RENDER ---
    return (
        <Panel
            isOpen={isOpen}
            onClose={onClose}
            title="Audit Record"
            subtitle={log.event}
            icon={Shield}
        >
            <div className="flex flex-col gap-6">
                {/* Header Card */}
                <div className="flex flex-col p-4 rounded-xl bg-surface-hover/50 border border-surface-border gap-3">
                    <div className="flex items-start justify-between gap-2">
                        <Badge variant="accent" size="md">
                            {log.event}
                        </Badge>
                        <span className="text-[11px] text-text-muted">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                        </span>
                    </div>

                    {/* Actor Details */}
                    <div className="flex items-center justify-between pt-2 border-t border-surface-border text-xs">
                        <span className="text-text-muted">Actor</span>
                        <div className="flex items-center gap-1.5 font-medium text-text">
                            <Avatar src={log.actor?.avatar} size="xs" />
                            <span>{actorName}</span>
                        </div>
                    </div>
                </div>

                {/* Attributes */}
                <div className="flex flex-col gap-3">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Log Attributes
                    </span>

                    <div className="flex flex-col divide-y divide-surface-border text-xs rounded-lg border border-surface-border bg-surface overflow-hidden">
                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted">Record ID</span>
                            <span className="font-mono text-[10px] text-text-muted select-text truncate max-w-[170px]">
                                {log.id}
                            </span>
                        </div>

                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted">Target Entity ID</span>
                            <span className="font-mono text-[10px] text-text-muted select-text truncate max-w-[170px]">
                                {log.entityId}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Event Payload Data */}
                <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Event Payload
                    </span>

                    <pre className="p-3 rounded-lg border border-surface-border bg-surface text-[11px] font-mono text-text overflow-x-auto select-text leading-relaxed">
                        {formattedData}
                    </pre>
                </div>
            </div>
        </Panel>
    );
};
