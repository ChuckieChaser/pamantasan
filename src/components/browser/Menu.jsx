// --- IMPORTS ---
import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Activity,
    Archive,
    Check,
    CheckCircle2,
    Download,
    Edit3,
    Eye,
    EyeOff,
    FileText,
    Folder,
    Globe,
    Info,
    Layers,
    MessageSquare,
    Paperclip,
    RotateCcw,
    Share2,
    Trash2,
    User,
    UserCheck,
    Users,
    UserX,
    XCircle,
} from 'lucide-react';
import { Container } from '../Container';
import { constants } from '../../constants';
import { useAuthStore, useDocumentStore } from '../../stores';
import { ICON_STYLE } from './common';


// --- COMPONENTS ---
const Menu = ({
    item,
    resourceName,
    anchorRect,
    onActionClick,
    isMultipleSelected = false,
    selectedCount = 1,
    selectedItems = [],
}) => {
    // REFS
    const menuRef = useRef(null);

    // STORES
    const currentUser = useAuthStore((state) => state.currentUser);
    const allDocumentShares = useDocumentStore((state) => state.documentShares ?? state.shares ?? []);

    // MOBILE VIEWPORT DETECTION
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 640);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // SMART POSITIONING (DYNAMIC MEASUREMENT, AUTO-FLIP & VIEWPORT CLAMPING)
    const [position, setPosition] = useState(() => {
        if (!anchorRect) return { top: 0, left: 0 };
        const estimatedHeight = 320;
        const estimatedWidth = 200;
        const spaceBelow = window.innerHeight - anchorRect.bottom;
        const spaceAbove = anchorRect.top;
        const shouldOpenUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
        const top = shouldOpenUpwards
            ? Math.max(8, anchorRect.top - estimatedHeight - 4)
            : Math.min(window.innerHeight - estimatedHeight - 8, anchorRect.bottom + 4);
        const left = Math.max(8, Math.min(window.innerWidth - estimatedWidth - 8, anchorRect.right - estimatedWidth));
        return { top, left };
    });

    useLayoutEffect(() => {
        if (!anchorRect) return;
        const updatePosition = () => {
            if (!anchorRect) return;
            const menuElement = menuRef.current;
            const menuHeight = menuElement ? menuElement.offsetHeight : 320;
            const menuWidth = menuElement ? menuElement.offsetWidth : 200;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            const spaceBelow = viewportHeight - anchorRect.bottom - 8;
            const spaceAbove = anchorRect.top - 8;

            let topPosition;
            if (spaceBelow >= menuHeight) {
                // Sufficient space below
                topPosition = anchorRect.bottom + 4;
            } else if (spaceAbove >= menuHeight) {
                // Flip upward when insufficient below but sufficient above
                topPosition = anchorRect.top - menuHeight - 4;
            } else {
                // Neither side has full space: pick the larger available area
                if (spaceAbove > spaceBelow) {
                    topPosition = anchorRect.top - menuHeight - 4;
                } else {
                    topPosition = anchorRect.bottom + 4;
                }
            }

            // Clamp vertical within viewport boundaries (8px safety margin)
            topPosition = Math.max(8, Math.min(viewportHeight - menuHeight - 8, topPosition));

            // Horizontal alignment: align right edge of menu to right edge of trigger button
            let leftPosition = anchorRect.right - menuWidth;
            // Clamp horizontal within viewport boundaries (8px safety margin)
            leftPosition = Math.max(8, Math.min(viewportWidth - menuWidth - 8, leftPosition));

            setPosition({ top: topPosition, left: leftPosition });
        };

        updatePosition();
        const frameId = requestAnimationFrame(updatePosition);

        window.addEventListener('resize', updatePosition, { passive: true });
        window.addEventListener('scroll', updatePosition, { capture: true, passive: true });

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [anchorRect, resourceName, item, isMultipleSelected]);

    // GUARD CLAUSES
    if (!item || !anchorRect) {
        return null;
    }

    // DERIVED VALUES
    const isFolder = item.isFolder;
    const isArchived = Boolean(item.isArchived);
    const isSelfUser = Boolean(
        currentUser && (
            item.id === currentUser.id ||
            (item.universityId && currentUser.universityId === item.universityId)
        )
    );
    const isAdmin = constants.isAdminRole(currentUser?.role);
    const isStaff = constants.isStaffRole(currentUser?.role);
    const isOfficer = constants.isOfficerRole(currentUser?.role);
    const isDirector = constants.isDirectorRole(currentUser?.role);
    const isMember = constants.isMemberRole(currentUser?.role);

    const cleanId = (id) => (typeof id === 'string' ? id.replace(/-/g, '').toLowerCase() : id);
    const userDeptClean = cleanId(currentUser?.departmentId ?? currentUser?.department?.id ?? currentUser?.department);

    const getItemEffectiveStatus = (it) => {
        const matchedShare = (allDocumentShares || []).find((s) => {
            const sDocId = cleanId(s.document?.id ?? s.documentId);
            const sDeptId = cleanId(s.department?.id ?? s.departmentId);
            return cleanId(it?.id) === sDocId && userDeptClean && sDeptId === userDeptClean;
        }) || it.share || null;
        const rawStatus = matchedShare?.status ?? it.status ?? it.share?.status;
        return (rawStatus && rawStatus !== '—') ? String(rawStatus).toUpperCase() : '';
    };

    const isDocShared = (it) => {
        const itCleanId = cleanId(it?.id);
        return Boolean(
            it?.share ||
            it?.departmentId ||
            (Array.isArray(it?.shares) && it.shares.length > 0) ||
            (allDocumentShares || []).some((s) => {
                const sDocId = cleanId(s.document?.id ?? s.documentId);
                const status = String(s.status || '').toUpperCase();
                return sDocId === itCleanId && status !== 'UNSHARED' && status !== 'REVOKED';
            })
        );
    };

    const targetSelection = isMultipleSelected && selectedItems.length > 0 ? selectedItems : [item];

    // Documents
    const pendingDocs = targetSelection.filter((it) => {
        const s = getItemEffectiveStatus(it);
        return !s || s === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL || s === 'PENDING';
    });
    const approvedDocs = targetSelection.filter(
        (it) => getItemEffectiveStatus(it) === constants.DOCUMENT_SHARES_STATUS.APPROVED
    );
    const rejectedDocs = targetSelection.filter(
        (it) => getItemEffectiveStatus(it) === constants.DOCUMENT_SHARES_STATUS.REJECTED
    );
    const publishedDocs = targetSelection.filter(
        (it) => getItemEffectiveStatus(it) === constants.DOCUMENT_SHARES_STATUS.PUBLISHED
    );
    const stashedDocs = targetSelection.filter(
        (it) => getItemEffectiveStatus(it) === constants.DOCUMENT_SHARES_STATUS.STASHED
    );
    const sharedDocs = targetSelection.filter(isDocShared);
    const unsharedDocs = targetSelection.filter((it) => !isDocShared(it));

    // Users
    const isSelfUserCheck = (u) => Boolean(
        currentUser && (
            u.id === currentUser.id ||
            (u.universityId && currentUser.universityId === u.universityId)
        )
    );
    const activeUsers = targetSelection.filter(
        (u) => String(u.status || '').toUpperCase() !== constants.USERS_STATUS.SUSPENDED
    );
    const activeUsersWithoutSelf = activeUsers.filter((u) => !isSelfUserCheck(u));
    const suspendedUsers = targetSelection.filter(
        (u) => String(u.status || '').toUpperCase() === constants.USERS_STATUS.SUSPENDED
    );

    // Document Requests
    const openDocRequests = targetSelection.filter((r) => {
        const s = String(r.status || '').toUpperCase();
        return s !== constants.DOCUMENT_REQUESTS_STATUS.RESOLVED && s !== constants.DOCUMENT_REQUESTS_STATUS.REJECTED;
    });

    // Coordinator Requests
    const pendingCoordRequests = targetSelection.filter((r) => {
        const s = String(r.status || '').toUpperCase();
        return !s || s === constants.COORDINATOR_REQUESTS_STATUS.PENDING;
    });

    const dynamicStyle = isMobile
        ? {
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            top: 'auto',
            zIndex: 9999,
        }
        : {
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 9999,
        };

    // RENDER
    return createPortal(
        <>
            {isMobile && (
                <div
                    className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-xs animate-fade-in"
                    onClick={(event) => onActionClick?.(event, 'close')}
                />
            )}
            <Container
                ref={menuRef}
                variant="dropdown"
                style={dynamicStyle}
                onClick={(event) => event.stopPropagation()}
                className={`${
                    isMobile
                        ? 'fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl max-h-[82vh] overflow-y-auto p-3.5 bg-surface border-t border-surface-border shadow-2xl animate-slide-up text-sm'
                        : 'animate-toast-in shadow-2xl min-w-48 text-xs select-none'
                } pointer-events-auto [&_button]:py-2.5 sm:[&_button]:py-2 [&_button]:text-sm sm:[&_button]:text-xs [&_button]:rounded-lg sm:[&_button]:rounded`}
            >
                {isMobile && (
                    <div className="flex flex-col items-center gap-1 pb-2.5 mb-1.5 border-b border-surface-border shrink-0 select-none">
                        <div className="w-10 h-1 rounded-full bg-surface-border" />
                        <span className="text-xs font-semibold text-text-muted truncate max-w-[85vw] px-2 text-center mt-1">
                            {isMultipleSelected
                                ? `${selectedCount} items selected`
                                : (item.name || item.title || item.code || 'Item Actions')}
                        </span>
                    </div>
                )}

                {/* 1. DEPARTMENTS */}
                {resourceName === 'departments' && (
                    <>
                        {/* Minor Actions (Flow action at top) */}
                        {!isMultipleSelected && (
                            <>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'edit', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Edit3 className={ICON_STYLE} />
                                    <span>Edit Department</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'view_information', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Eye className={ICON_STYLE} />
                                    <span>View Information</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'view_faculty', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Users className={ICON_STYLE} />
                                    <span>View User</span>
                                </button>
                                <div className="h-px bg-surface-border my-1" />
                            </>
                        )}

                        {/* Destructive Action */}
                        <button
                            type="button"
                            onClick={(event) => onActionClick?.(event, 'delete', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <Trash2 className={ICON_STYLE} />
                            <span>{isMultipleSelected ? `Delete all (${selectedCount})` : 'Delete Department'}</span>
                        </button>
                    </>
                )}

                {/* 2. USERS */}
                {resourceName === 'users' && (() => {
                    const hasPrimaryUnsuspend = isMultipleSelected
                        ? suspendedUsers.length > 0
                        : item.status === constants.USERS_STATUS.SUSPENDED;

                    const canSuspend = isMultipleSelected
                        ? activeUsersWithoutSelf.length > 0
                        : (!isSelfUser && item.status !== constants.USERS_STATUS.SUSPENDED);

                    return (
                        <>
                            {/* Primary Action (Top): Unsuspend */}
                            {hasPrimaryUnsuspend && (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'unsuspend', isMultipleSelected ? suspendedUsers : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-success hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <UserCheck className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Unsuspend all (${suspendedUsers.length})` : 'Unsuspend'}</span>
                                </button>
                            )}

                            {hasPrimaryUnsuspend && <div className="h-px bg-surface-border my-1" />}

                            {/* Minor Actions: Flow at top, then utilities */}
                            {!isMultipleSelected && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'edit', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Edit3 className={ICON_STYLE} />
                                        <span>Edit</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'view_profile', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <User className={ICON_STYLE} />
                                        <span>View Information</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'view_activity', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Activity className={ICON_STYLE} />
                                        <span>View Activity</span>
                                    </button>
                                </>
                            )}

                            {/* Destructive Action (Bottom): Suspend (HIDDEN for self or unavailable) */}
                            {canSuspend && (
                                <>
                                    <div className="h-px bg-surface-border my-1" />
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'suspend', isMultipleSelected ? activeUsersWithoutSelf : item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <UserX className={ICON_STYLE} />
                                        <span>{isMultipleSelected ? `Suspend all (${activeUsersWithoutSelf.length})` : 'Suspend'}</span>
                                    </button>
                                </>
                            )}
                        </>
                    );
                })()}

                {/* 3. DOCUMENT REQUESTS */}
                {resourceName === 'document_requests' && (() => {
                    const hasPrimaryResolve = isStaff && (isMultipleSelected ? openDocRequests.length > 0 : item.status === constants.DOCUMENT_REQUESTS_STATUS.OPEN);
                    const canDelete = isMultipleSelected
                        ? (openDocRequests.length > 0 && (!isStaff || isAdmin))
                        : (item.status === constants.DOCUMENT_REQUESTS_STATUS.OPEN && (!isStaff || isAdmin));
                    const canReject = isStaff && (isMultipleSelected ? openDocRequests.length > 0 : item.status === constants.DOCUMENT_REQUESTS_STATUS.OPEN);

                    return (
                        <>
                            {/* Primary Action (Top): Resolve Request */}
                            {hasPrimaryResolve && (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'resolve', isMultipleSelected ? openDocRequests : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <CheckCircle2 className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Resolve all (${openDocRequests.length})` : 'Resolve Request'}</span>
                                </button>
                            )}

                            {hasPrimaryResolve && <div className="h-px bg-surface-border my-1" />}

                            {/* Minor Actions: Flow at top, then utilities */}
                            {!isMultipleSelected && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'view_request', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Eye className={ICON_STYLE} />
                                        <span>Open Request</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'view_information', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Info className={ICON_STYLE} />
                                        <span>View Information</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'view_message', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <MessageSquare className={ICON_STYLE} />
                                        <span>View Message</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'view_attachment', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Paperclip className={ICON_STYLE} />
                                        <span>View Attachment</span>
                                    </button>
                                </>
                            )}

                            {/* Destructive Actions (Bottom): Reject & Delete */}
                            {(canReject || canDelete) && (
                                <>
                                    <div className="h-px bg-surface-border my-1" />
                                    {canReject && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'reject', isMultipleSelected ? openDocRequests : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <XCircle className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Reject all (${openDocRequests.length})` : 'Reject Request'}</span>
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'delete', isMultipleSelected ? openDocRequests : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Trash2 className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Delete all (${openDocRequests.length})` : 'Delete Request'}</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    );
                })()}

                {/* 4. COORDINATOR REQUESTS */}
                {resourceName === 'coordinator_requests' && (() => {
                    const hasPrimaryApprove = isAdmin && (isMultipleSelected ? pendingCoordRequests.length > 0 : item.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING);
                    const canReject = isAdmin && (isMultipleSelected ? pendingCoordRequests.length > 0 : item.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING);
                    const canDelete = !isAdmin && (isMultipleSelected ? pendingCoordRequests.length > 0 : item.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING);

                    return (
                        <>
                            {/* Primary Action (Top): Approve */}
                            {hasPrimaryApprove && (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'approve', isMultipleSelected ? pendingCoordRequests : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <CheckCircle2 className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Approve all (${pendingCoordRequests.length})` : 'Approve'}</span>
                                </button>
                            )}

                            {hasPrimaryApprove && <div className="h-px bg-surface-border my-1" />}

                            {/* Minor Action: View Payload */}
                            {!isMultipleSelected && (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'view_payload', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Eye className={ICON_STYLE} />
                                    <span>View Payload</span>
                                </button>
                            )}

                            {/* Destructive Actions (Bottom): Reject (Admin) or Delete (Coordinator) */}
                            {(canReject || canDelete) && (
                                <>
                                    <div className="h-px bg-surface-border my-1" />
                                    {canReject && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'reject', isMultipleSelected ? pendingCoordRequests : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <XCircle className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Reject all (${pendingCoordRequests.length})` : 'Reject'}</span>
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'delete', isMultipleSelected ? pendingCoordRequests : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Trash2 className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Delete all (${pendingCoordRequests.length})` : 'Delete Request'}</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    );
                })()}

                {/* 5. DOCUMENTS, ARCHIVES, MY_REQUESTS */}
                {(resourceName === 'documents' || resourceName === 'archives' || resourceName === 'my_requests') && (() => {
                    const targetType = isFolder ? 'Folder' : 'File';
                    const effStatus = getItemEffectiveStatus(item);
                    const isShared = isDocShared(item);
                    const isPublished = effStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED;
                    const isStashed = effStatus === constants.DOCUMENT_SHARES_STATUS.STASHED;
                    const isApproved = effStatus === constants.DOCUMENT_SHARES_STATUS.APPROVED;
                    const isRejected = effStatus === constants.DOCUMENT_SHARES_STATUS.REJECTED;
                    const isPending = !effStatus || effStatus === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL || effStatus === 'PENDING';

                    // MEMBER ROLE: Open, Download, View Info, View Version
                    if (isMember) {
                        return (
                            <>
                                {!isMultipleSelected && !isArchived && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'open', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        {isFolder ? <Folder className={ICON_STYLE} /> : <FileText className={ICON_STYLE} />}
                                        <span>{`Open ${targetType}`}</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'download', isMultipleSelected ? targetSelection : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Download className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Download all (${selectedCount})` : `Download ${targetType}`}</span>
                                </button>

                                {!isMultipleSelected && (
                                    <>
                                        <div className="h-px bg-surface-border my-1" />
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'view_information', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Info className={ICON_STYLE} />
                                            <span>View Information</span>
                                        </button>
                                        {!isFolder && (
                                            <button
                                                type="button"
                                                onClick={(event) => onActionClick?.(event, 'view_version', item)}
                                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                            >
                                                <Layers className={ICON_STYLE} />
                                                <span>View Version</span>
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        );
                    }

                    // OFFICER ROLE:
                    // Primary: Approve
                    // Minor: Open, Unapprove, Unreject, Download, View Info, View Version
                    // Destructive: Reject
                    // Note: If published or stashed, Officer approval actions are hidden!
                    if (isOfficer) {
                        const canOfficerApprove = isMultipleSelected ? pendingDocs.length > 0 : (isPending && !isPublished && !isStashed);
                        const canOfficerReject = isMultipleSelected ? pendingDocs.length > 0 : (isPending && !isPublished && !isStashed);
                        const canOfficerUnapprove = isMultipleSelected ? approvedDocs.length > 0 : (isApproved && !isPublished && !isStashed);
                        const canOfficerUnreject = isMultipleSelected ? rejectedDocs.length > 0 : (isRejected && !isPublished && !isStashed);

                        return (
                            <>
                                {/* Primary Action (Top): Approve */}
                                {canOfficerApprove && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'approve', isMultipleSelected ? pendingDocs : item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Check className={ICON_STYLE} />
                                        <span>{isMultipleSelected ? `Approve all (${pendingDocs.length})` : `Approve ${targetType}`}</span>
                                    </button>
                                )}

                                {canOfficerApprove && <div className="h-px bg-surface-border my-1" />}

                                {/* Minor Actions: Flow at top */}
                                {!isMultipleSelected && !isArchived && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'open', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        {isFolder ? <Folder className={ICON_STYLE} /> : <FileText className={ICON_STYLE} />}
                                        <span>{`Open ${targetType}`}</span>
                                    </button>
                                )}

                                {canOfficerUnapprove && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'unapprove', isMultipleSelected ? approvedDocs : item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <RotateCcw className={ICON_STYLE} />
                                        <span>{isMultipleSelected ? `Unapprove all (${approvedDocs.length})` : `Unapprove ${targetType}`}</span>
                                    </button>
                                )}

                                {canOfficerUnreject && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'unreject', isMultipleSelected ? rejectedDocs : item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <RotateCcw className={ICON_STYLE} />
                                        <span>{isMultipleSelected ? `Unreject all (${rejectedDocs.length})` : `Unreject ${targetType}`}</span>
                                    </button>
                                )}

                                {/* Utilities */}
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'download', isMultipleSelected ? targetSelection : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Download className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Download all (${selectedCount})` : `Download ${targetType}`}</span>
                                </button>

                                {!isMultipleSelected && (
                                    <>
                                        <div className="h-px bg-surface-border my-1" />
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'view_information', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Info className={ICON_STYLE} />
                                            <span>View Information</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, isFolder ? 'view_content' : 'view_version', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            {isFolder ? <Folder className={ICON_STYLE} /> : <Layers className={ICON_STYLE} />}
                                            <span>{isFolder ? 'View Content' : 'View Version'}</span>
                                        </button>
                                        {!isArchived && (
                                            <button
                                                type="button"
                                                onClick={(event) => onActionClick?.(event, 'view_share', item)}
                                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                            >
                                                <Share2 className={ICON_STYLE} />
                                                <span>Open Shares</span>
                                            </button>
                                        )}
                                    </>
                                )}

                                {/* Destructive Action (Bottom): Reject */}
                                {canOfficerReject && (
                                    <>
                                        <div className="h-px bg-surface-border my-1" />
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'reject', isMultipleSelected ? pendingDocs : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <XCircle className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Reject all (${pendingDocs.length})` : `Reject ${targetType}`}</span>
                                        </button>
                                    </>
                                )}
                            </>
                        );
                    }

                    // DIRECTOR ROLE:
                    // Primary: Publish / Re-Publish (Prerequisite: Must be approved by Officer!)
                    // Minor: Open, Unpublish (Neutral styling!), Stash (Prerequisite: Approved & Unpublished!), Unstash, Download, View Info, View Version
                    if (isDirector) {
                        const approvedUnpublishedDocs = approvedDocs.filter((d) => getItemEffectiveStatus(d) !== constants.DOCUMENT_SHARES_STATUS.PUBLISHED);
                        const canDirectorPublish = isMultipleSelected ? approvedUnpublishedDocs.length > 0 : (isApproved && !isPublished);
                        const canDirectorRePublish = isMultipleSelected ? publishedDocs.length > 0 : isPublished;
                        const canDirectorUnpublish = isMultipleSelected ? publishedDocs.length > 0 : isPublished;
                        const approvedNonStashedDocs = approvedDocs.filter((d) => {
                            const s = getItemEffectiveStatus(d);
                            return s !== constants.DOCUMENT_SHARES_STATUS.PUBLISHED && s !== constants.DOCUMENT_SHARES_STATUS.STASHED;
                        });
                        const canDirectorStash = isMultipleSelected ? approvedNonStashedDocs.length > 0 : (isApproved && !isPublished && !isStashed);
                        const canDirectorUnstash = isMultipleSelected ? stashedDocs.length > 0 : isStashed;

                        return (
                            <>
                                {/* Primary Action (Top): Publish or Re-Publish */}
                                {canDirectorPublish && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'publish', isMultipleSelected ? approvedUnpublishedDocs : item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Globe className={ICON_STYLE} />
                                        <span>{isMultipleSelected ? `Publish all (${approvedUnpublishedDocs.length})` : `Publish ${targetType}`}</span>
                                    </button>
                                )}

                                {canDirectorRePublish && !canDirectorPublish && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 're_publish', isMultipleSelected ? publishedDocs : item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Globe className={ICON_STYLE} />
                                        <span>{isMultipleSelected ? `Re-Publish all (${publishedDocs.length})` : `Re-Publish ${targetType}`}</span>
                                    </button>
                                )}

                                {(canDirectorPublish || canDirectorRePublish) && <div className="h-px bg-surface-border my-1" />}

                                {/* Minor Actions: Flow at top */}
                                {!isMultipleSelected && !isArchived && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'open', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        {isFolder ? <Folder className={ICON_STYLE} /> : <FileText className={ICON_STYLE} />}
                                        <span>{`Open ${targetType}`}</span>
                                    </button>
                                )}

                                {/* Unpublish is NEUTRAL secondary styling, NOT warning/red */}
                                {canDirectorUnpublish && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'unpublish', isMultipleSelected ? publishedDocs : item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <EyeOff className={ICON_STYLE} />
                                        <span>{isMultipleSelected ? `Unpublish all (${publishedDocs.length})` : `Unpublish ${targetType}`}</span>
                                    </button>
                                )}

                                {/* Stash: Only if approved and NOT published */}
                                {canDirectorStash && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'stash', isMultipleSelected ? approvedNonStashedDocs : item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Layers className={ICON_STYLE} />
                                        <span>{isMultipleSelected ? `Stash all (${approvedNonStashedDocs.length})` : `Stash ${targetType}`}</span>
                                    </button>
                                )}

                                {canDirectorUnstash && (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'unstash', isMultipleSelected ? stashedDocs : item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <RotateCcw className={ICON_STYLE} />
                                        <span>{isMultipleSelected ? `Unstash all (${stashedDocs.length})` : `Unstash ${targetType}`}</span>
                                    </button>
                                )}

                                {/* Utilities */}
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'download', isMultipleSelected ? targetSelection : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Download className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Download all (${selectedCount})` : `Download ${targetType}`}</span>
                                </button>

                                {!isMultipleSelected && (
                                    <>
                                        <div className="h-px bg-surface-border my-1" />
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'view_information', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Info className={ICON_STYLE} />
                                            <span>View Information</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, isFolder ? 'view_content' : 'view_version', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            {isFolder ? <Folder className={ICON_STYLE} /> : <Layers className={ICON_STYLE} />}
                                            <span>{isFolder ? 'View Content' : 'View Version'}</span>
                                        </button>
                                        {!isArchived && (
                                            <button
                                                type="button"
                                                onClick={(event) => onActionClick?.(event, 'view_share', item)}
                                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                            >
                                                <Share2 className={ICON_STYLE} />
                                                <span>Open Shares</span>
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        );
                    }

                    // ADMIN & COORDINATOR (STAFF):
                    // Primary: Restore (if archived) OR Share / Re-Share (if unarchived)
                    // Minor: Open, Edit, Unshare (only if shared!), Download, View Info, View Version, View Share
                    // Destructive: Archive (only if unshared!), Delete (only if unshared or archived!)
                    const canAdminShare = !isArchived && (isMultipleSelected ? unsharedDocs.length > 0 : !isShared);
                    const canAdminReShare = !isArchived && (isMultipleSelected ? sharedDocs.length > 0 : isShared);
                    const canAdminUnshare = !isArchived && (isMultipleSelected ? sharedDocs.length > 0 : isShared);
                    const canAdminArchive = !isArchived && (isMultipleSelected ? unsharedDocs.length > 0 : !isShared);
                    const canAdminDelete = isArchived
                        ? true
                        : (isMultipleSelected ? unsharedDocs.length > 0 : !isShared);

                    return (
                        <>
                            {/* Primary Action (Top): Restore or Share / Re-Share */}
                            {isArchived ? (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'restore', isMultipleSelected ? targetSelection : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <RotateCcw className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Restore all (${selectedCount})` : `Restore ${targetType}`}</span>
                                </button>
                            ) : (
                                <>
                                    {canAdminShare && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'share', isMultipleSelected ? unsharedDocs : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Share2 className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Share all (${unsharedDocs.length})` : `Share ${targetType}`}</span>
                                        </button>
                                    )}
                                    {canAdminReShare && !canAdminShare && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 're_share', isMultipleSelected ? sharedDocs : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Share2 className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Re-Share all (${sharedDocs.length})` : `Re-Share ${targetType}`}</span>
                                        </button>
                                    )}
                                </>
                            )}

                            <div className="h-px bg-surface-border my-1" />

                            {/* Minor Actions: Flow at top, then utilities */}
                            {!isMultipleSelected && !isArchived && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'open', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        {isFolder ? <Folder className={ICON_STYLE} /> : <FileText className={ICON_STYLE} />}
                                        <span>{`Open ${targetType}`}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'edit', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Edit3 className={ICON_STYLE} />
                                        <span>{`Edit ${targetType}`}</span>
                                    </button>
                                </>
                            )}

                            {/* Unshare: Only if shared */}
                            {canAdminUnshare && (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'unshare', isMultipleSelected ? sharedDocs : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <RotateCcw className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Unshare all (${sharedDocs.length})` : `Unshare ${targetType}`}</span>
                                </button>
                            )}

                            {/* Utilities */}
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'download', isMultipleSelected ? targetSelection : item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Download className={ICON_STYLE} />
                                <span>{isMultipleSelected ? `Download all (${selectedCount})` : `Download ${targetType}`}</span>
                            </button>

                            {!isMultipleSelected && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'view_information', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Info className={ICON_STYLE} />
                                        <span>View Information</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, isFolder ? 'view_content' : 'view_version', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        {isFolder ? <Folder className={ICON_STYLE} /> : <Layers className={ICON_STYLE} />}
                                        <span>{isFolder ? 'View Content' : 'View Version'}</span>
                                    </button>
                                    {!isArchived && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'view_share', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Share2 className={ICON_STYLE} />
                                            <span>Open Shares</span>
                                        </button>
                                    )}
                                </>
                            )}

                            {/* Destructive Actions (Bottom): Archive & Delete (Gated: Shared files must be unshared first!) */}
                            {(canAdminArchive || canAdminDelete) && (
                                <>
                                    <div className="h-px bg-surface-border my-1" />
                                    {canAdminArchive && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'archive', isMultipleSelected ? unsharedDocs : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Archive className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Archive all (${unsharedDocs.length})` : `Archive ${targetType}`}</span>
                                        </button>
                                    )}
                                    {canAdminDelete && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'delete', isMultipleSelected ? (isArchived ? targetSelection : unsharedDocs) : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Trash2 className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Delete all (${isArchived ? selectedCount : unsharedDocs.length})` : `Delete ${targetType}`}</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    );
                })()}
            </Container>
        </>,
        document.body
    );
};


// --- EXPORTS ---
export { Menu };

