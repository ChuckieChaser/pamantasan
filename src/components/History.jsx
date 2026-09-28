// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    CheckCircle2,
    Clock,
    Eye,
    FileText,
    RotateCcw,
    Search,
    UserCheck,
    XCircle,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Container } from './Container';
import { SearchField } from './Fields';
import { formatDateTime } from './common';


// --- COMPONENTS ---
const History = ({
    title = 'Suspended Users',
    description = null,
    data = [],
    selectedId = null,
    onItemClick = null,
    onItemAction = null,
    resourceName = 'users',
    emptyMessage = 'No suspended users on record.',
    searchPlaceholder = 'Search records...',
    className,
    ...props
}) => {
    // STATES
    const [searchQuery, setSearchQuery] = useState('');

    // FILTERED DATA
    const filteredHistory = useMemo(() => {
        if (!searchQuery.trim()) {
            return data;
        }

        const query = searchQuery.trim().toLowerCase();
        return data.filter((item) => {
            const name = (item.title || item.name || item.subject || item.action || '').toLowerCase();
            const universityId = (item.universityId || '').toLowerCase();
            const email = (item.email || '').toLowerCase();
            const department = (item.department || item.departmentCode || '').toLowerCase();
            const role = (item.role || '').toLowerCase();
            const status = (item.status || '').toLowerCase();
            const requester = (item.requesterName || item.requester || '').toLowerCase();
            const reason = (item.rejectionReason || '').toLowerCase();

            return (
                name.includes(query) ||
                universityId.includes(query) ||
                email.includes(query) ||
                department.includes(query) ||
                role.includes(query) ||
                status.includes(query) ||
                requester.includes(query) ||
                reason.includes(query)
            );
        });
    }, [data, searchQuery]);

    // RENDER
    return (
        <Container
            variant="panel"
            className={`p-4 sm:p-5 rounded-2xl bg-surface border border-surface-border flex flex-col gap-4 shadow-xs select-none ${className ?? ''}`.trim()}
            {...props}
        >
            {/* 1. AUDIT LEDGER HEADER WITH COMPACT SEARCH */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3.5">
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-base sm:text-lg font-bold text-text font-serif tracking-tight truncate">
                            {title}
                        </h2>
                        <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-surface-hover/90 text-text-muted font-medium border border-surface-border shrink-0 shadow-2xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                            <span>{data.length} {data.length === 1 ? 'record' : 'records'}</span>
                        </span>
                    </div>

                    {description && (
                        <p className="text-xs text-text-muted max-w-2xl leading-relaxed line-clamp-1">
                            {description}
                        </p>
                    )}
                </div>

                {/* COMPACT SEARCH FILTER INLINE IN HEADER */}
                {data.length > 0 && (
                    <div className="w-full sm:w-64 md:w-72 shrink-0">
                        <SearchField
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClear={() => setSearchQuery('')}
                        />
                    </div>
                )}
            </div>

            {/* 2. AUDIT LEDGER STREAM (STRICT 10 ITEMS BEFORE SCROLL) */}
            <div className="max-h-[520px] overflow-y-auto pr-1">
                {filteredHistory.length === 0 ? (
                    <div className="py-12 sm:py-14 px-4 text-center border border-dashed border-surface-border rounded-xl bg-surface-hover/20 flex flex-col items-center justify-center gap-2.5">
                        <div className="p-3 rounded-xl bg-surface-hover text-text-muted border border-surface-border/60 shadow-2xs">
                            <Clock className="h-5 w-5 text-text-muted" />
                        </div>
                        <div className="flex flex-col items-center gap-1 max-w-sm">
                            <span className="font-bold text-xs sm:text-sm text-text">
                                {searchQuery ? 'No matching historical records found' : emptyMessage}
                            </span>
                            <p className="text-xs text-text-muted leading-relaxed">
                                {searchQuery
                                    ? `No entries match "${searchQuery}". Try clearing your query.`
                                    : (description || 'Preserved for compliance and auditing.')}
                            </p>
                        </div>
                        {searchQuery && (
                            <Button
                                variant="secondary"
                                leadingIcon={RotateCcw}
                                onClick={() => setSearchQuery('')}
                                label="Clear search"
                                className="mt-1 shadow-2xs h-8 text-xs py-1 px-2.5"
                            />
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {filteredHistory.map((item) => {
                            const isSelected = selectedId === item.id;
                            const isApproved = item.status === 'APPROVED' || item.status === 'RESOLVED';
                            const isRejected = item.status === 'REJECTED';

                            return (
                                <div
                                    key={item.id}
                                    data-record-id={item.id}
                                    onClick={() => onItemClick?.(item)}
                                    className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs cursor-pointer group ${
                                        isSelected
                                            ? 'bg-accent/10 border-accent/50 shadow-xs'
                                            : 'bg-surface hover:bg-surface-hover/60 border-surface-border'
                                    }`}
                                >
                                    {/* LEFT DETAILS */}
                                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                        {resourceName === 'users' ? (
                                            <Avatar
                                                src={item.avatarPath}
                                                user={item.user ?? item}
                                                alt={item.title ?? item.name}
                                                size="small"
                                                className="h-8 w-8 rounded-full aspect-square shrink-0 ring-1 ring-surface-border shadow-2xs mt-0.5 sm:mt-0"
                                            />
                                        ) : (
                                            <div className={`p-2 rounded-lg shrink-0 border ${
                                                isApproved
                                                    ? 'bg-accent-background text-accent border-accent-border'
                                                    : isRejected
                                                    ? 'bg-error-background text-error border-error-border'
                                                    : 'bg-surface-hover text-text-muted border-surface-border'
                                            }`}>
                                                <FileText className="h-4 w-4" />
                                            </div>
                                        )}

                                        <div className="flex flex-col min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-xs sm:text-sm text-text truncate group-hover:text-accent transition-colors">
                                                    {item.title ?? item.name ?? item.subject ?? item.action}
                                                </span>

                                                {item.role && (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-surface-hover text-text-muted border-surface-border">
                                                        {item.role}
                                                    </span>
                                                )}

                                                {item.status && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                        isApproved
                                                            ? 'bg-accent-background text-accent border-accent-border'
                                                            : isRejected || item.status === 'SUSPENDED'
                                                            ? 'bg-error-background text-error border-error-border'
                                                            : 'bg-surface-hover text-text-muted border-surface-border'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                )}
                                            </div>

                                            {/* METADATA LINE */}
                                            <div className="flex items-center gap-1.5 text-xs text-text-muted truncate mt-0.5">
                                                {resourceName === 'coordinator_requests' ? (
                                                    <>
                                                        {item.requesterName && <span>Coordinator: {item.requesterName}</span>}
                                                        {item.requesterName && item.department && <span>•</span>}
                                                        {item.department && <span className="truncate">{item.department}</span>}
                                                    </>
                                                ) : resourceName === 'document_requests' ? (
                                                    <>
                                                        {item.requesterName && <span>Requester: {item.requesterName}</span>}
                                                        {item.messageCount && <span>•</span>}
                                                        {item.messageCount && <span>{item.messageCount}</span>}
                                                        {item.attachments?.length > 0 && <span>•</span>}
                                                        {item.attachments?.length > 0 && <span>{item.attachments.length} attachment{item.attachments.length === 1 ? '' : 's'}</span>}
                                                    </>
                                                ) : (
                                                    <>
                                                        {item.universityId && (
                                                            <>
                                                                <span>{item.universityId}</span>
                                                                <span>•</span>
                                                            </>
                                                        )}
                                                        {item.email && (
                                                            <>
                                                                <span className="truncate">{item.email}</span>
                                                                <span>•</span>
                                                            </>
                                                        )}
                                                        <span className="truncate">{item.department || item.departmentCode || 'Central'}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT SIDE: TIMESTAMP & ACTION */}
                                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                        <span className="text-[11px] text-text-muted font-mono whitespace-nowrap">
                                            {item.date || (item.updatedAt ? formatDateTime(item.updatedAt) : 'Archived')}
                                        </span>

                                        {resourceName === 'users' && onItemAction && (
                                            <Button
                                                variant="secondary"
                                                leadingIcon={UserCheck}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onItemAction('unsuspend', item);
                                                }}
                                                label="Unsuspend"
                                                className="h-8 text-xs py-1 px-2.5 shadow-2xs"
                                            />
                                        )}

                                        {resourceName === 'coordinator_requests' && (
                                            <Button
                                                variant="secondary"
                                                leadingIcon={Eye}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onItemAction?.('view_payload', item);
                                                }}
                                                label="Review"
                                                className="h-8 text-xs py-1 px-2.5 shadow-2xs"
                                            />
                                        )}

                                        {resourceName === 'document_requests' && (
                                            <Button
                                                variant="secondary"
                                                leadingIcon={Eye}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onItemAction?.('view_request', item);
                                                }}
                                                label="View"
                                                className="h-8 text-xs py-1 px-2.5 shadow-2xs"
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Container>
    );
};


// --- EXPORTS ---
export { History };
export default History;
