// --- IMPORTS ---
import { useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2,
    ChevronRight,
    Clock,
    FileCheck,
    Search,
    XCircle,
} from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/forms/Input';
import { Select } from '../../../components/forms/Select';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { useCoordinator } from '../hooks/useCoordinator';
import { COORDINATOR_STATUS } from '../coordinatorConstants';
import { CoordinatorInspector } from './CoordinatorInspector';


// --- CONFIGURATIONS ---
const STATUS_FILTER_OPTIONS = [
    { value: '', label: 'All Requests' },
    { value: COORDINATOR_STATUS.PENDING, label: 'Pending' },
    { value: COORDINATOR_STATUS.APPROVED, label: 'Approved' },
    { value: COORDINATOR_STATUS.REJECTED, label: 'Rejected' },
];

const STATUS_BADGE_VARIANT = {
    [COORDINATOR_STATUS.PENDING]:  'warning',
    [COORDINATOR_STATUS.APPROVED]: 'success',
    [COORDINATOR_STATUS.REJECTED]: 'error',
};


// --- COMPONENTS ---
export const CoordinatorExplorer = ({ currentUserId }) => {
    // --- HOOKS & STATE ---
    const {
        coordinatorRequests,
        isLoading,
        handleGetCoordinatorRequests,
        selectedCoordinatorRequest,
        setSelectedCoordinatorRequest,
    } = useCoordinator();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        handleGetCoordinatorRequests();
    }, [handleGetCoordinatorRequests]);

    // --- DERIVED VALUES ---
    const filteredRequests = useMemo(() => {
        return (coordinatorRequests ?? []).filter((req) => {
            const matchesStatus = !statusFilter || req.status === statusFilter;
            if (!matchesStatus) return false;

            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase().trim();
            const action = (req.action ?? '').toLowerCase();
            const requester = `${req.requester?.givenName ?? ''} ${req.requester?.lastName ?? ''}`.toLowerCase();
            return action.includes(query) || requester.includes(query);
        });
    }, [coordinatorRequests, searchQuery, statusFilter]);

    // --- HANDLERS ---
    const handleSelect = (req) => {
        setSelectedCoordinatorRequest(req);
    };

    const handleCloseInspector = () => {
        setSelectedCoordinatorRequest(null);
    };

    // --- RENDER ---
    return (
        <div className="flex flex-col gap-5 w-full">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl">
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search coordinator requests..."
                        leadingIcon={Search}
                        isClearable
                        onClear={() => setSearchQuery('')}
                        className="sm:w-72"
                    />

                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        options={STATUS_FILTER_OPTIONS}
                        className="sm:w-40"
                    />
                </div>
            </div>

            {/* List Viewport */}
            {isLoading && (!coordinatorRequests || coordinatorRequests.length === 0) ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <LoadingSpinner size="lg" />
                    <span className="text-xs text-text-muted">Loading coordinator queue...</span>
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="py-16 text-center rounded-xl border border-dashed border-surface-border bg-surface/50 p-6 flex flex-col items-center justify-center gap-2">
                    <FileCheck className="h-8 w-8 text-text-muted opacity-50" />
                    <h3 className="text-sm font-semibold text-text">No coordinator requests</h3>
                    <p className="text-xs text-text-muted max-w-sm">
                        All coordinator sign-offs and administrative reviews are currently clear.
                    </p>
                </div>
            ) : (
                <>
                    {/* Mobile Card List (sm:hidden) */}
                    <div className="flex sm:hidden flex-col gap-2.5">
                        {filteredRequests.map((req) => {
                            const isSelected = selectedCoordinatorRequest?.id === req.id;
                            const badgeVariant = STATUS_BADGE_VARIANT[req.status] ?? 'neutral';
                            const requesterName = `${req.requester?.givenName ?? ''} ${req.requester?.lastName ?? ''}`.trim() || 'Requester';

                            return (
                                <Card
                                    key={req.id}
                                    variant="interactive"
                                    padding="sm"
                                    onClick={() => handleSelect(req)}
                                    className={isSelected ? 'border-accent ring-1 ring-accent' : ''}
                                >
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <Badge variant={badgeVariant} size="sm">
                                                {req.status}
                                            </Badge>
                                            <span className="text-[10px] text-text-muted flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ''}
                                            </span>
                                        </div>

                                        <h4 className="text-sm font-semibold text-text truncate">
                                            {req.action?.replace(/_/g, ' ')}
                                        </h4>

                                        <div className="flex items-center justify-between pt-1 border-t border-surface-border text-xs text-text-muted">
                                            <div className="flex items-center gap-1.5">
                                                <Avatar src={req.requester?.avatar} size="xs" />
                                                <span className="truncate max-w-[140px]">{requesterName}</span>
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
                                    <th className="py-3 px-4">Action</th>
                                    <th className="py-3 px-4">Requester</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Submitted</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-border text-sm">
                                {filteredRequests.map((req) => {
                                    const isSelected = selectedCoordinatorRequest?.id === req.id;
                                    const badgeVariant = STATUS_BADGE_VARIANT[req.status] ?? 'neutral';
                                    const requesterName = `${req.requester?.givenName ?? ''} ${req.requester?.lastName ?? ''}`.trim() || req.requester?.email || '—';

                                    return (
                                        <tr
                                            key={req.id}
                                            onClick={() => handleSelect(req)}
                                            className={`hover:bg-surface-hover/70 cursor-pointer transition-colors ${
                                                isSelected ? 'bg-accent/5' : ''
                                            }`}
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-center shrink-0 text-text-muted">
                                                        <FileCheck className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-semibold text-text truncate">
                                                        {req.action?.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <Avatar src={req.requester?.avatar} size="xs" />
                                                    <span className="font-medium text-text truncate max-w-[150px]">
                                                        {requesterName}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <Badge variant={badgeVariant} size="sm">
                                                    {req.status}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-4 text-xs text-text-muted">
                                                {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Coordinator Details & Approval Inspector */}
            <CoordinatorInspector
                request={selectedCoordinatorRequest}
                isOpen={Boolean(selectedCoordinatorRequest)}
                onClose={handleCloseInspector}
                currentUserId={currentUserId}
            />
        </div>
    );
};
