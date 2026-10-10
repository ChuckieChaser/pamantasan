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

    const allDocumentShares = useDocumentStore((state) => state.documentShares ?? state.shares ?? []);

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
    const unpublishedDocs = targetSelection.filter((it) => {
        const s = getItemEffectiveStatus(it);
        return s !== constants.DOCUMENT_SHARES_STATUS.PUBLISHED && s !== constants.DOCUMENT_SHARES_STATUS.STASHED;
    });
    const sharedDocs = targetSelection.filter(isDocShared);
    const unsharedDocs = targetSelection.filter((it) => !isDocShared(it));

    // Users
    const activeUsers = targetSelection.filter(
        (u) => String(u.status || '').toUpperCase() !== constants.USERS_STATUS.SUSPENDED
    );
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
                {resourceName === 'departments' && (
                <>
                    {!isMultipleSelected && (
                        <>
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
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'edit', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Edit3 className={ICON_STYLE} />
                                <span>Edit</span>
                            </button>
                            <div className="h-px bg-surface-border my-1" />
                        </>
                    )}
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'delete', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Trash2 className={ICON_STYLE} />
                        <span>{isMultipleSelected ? `Delete (${selectedCount})` : 'Delete'}</span>
                    </button>
                </>
            )}

            {resourceName === 'users' && (
                <>
                    {!isMultipleSelected && (
                        <>
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
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'edit', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Edit3 className={ICON_STYLE} />
                                <span>Edit</span>
                            </button>
                            <div className="h-px bg-surface-border my-1" />
                        </>
                    )}
                    {isMultipleSelected ? (
                        activeUsers.length > 0 && suspendedUsers.length > 0 ? (
                            <>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'suspend', activeUsers)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <UserX className={ICON_STYLE} />
                                    <span>{`Suspend (${activeUsers.length})`}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'unsuspend', suspendedUsers)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-success hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <UserCheck className={ICON_STYLE} />
                                    <span>{`Unsuspend (${suspendedUsers.length})`}</span>
                                </button>
                            </>
                        ) : suspendedUsers.length > 0 ? (
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'unsuspend', suspendedUsers)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-success hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <UserCheck className={ICON_STYLE} />
                                <span>{`Unsuspend (${selectedCount})`}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'suspend', activeUsers)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <UserX className={ICON_STYLE} />
                                <span>{`Suspend (${selectedCount})`}</span>
                            </button>
                        )
                    ) : item.status === constants.USERS_STATUS.SUSPENDED ? (
                        <button
                            type="button"
                            onClick={(event) => onActionClick?.(event, 'unsuspend', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-success hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <UserCheck className={ICON_STYLE} />
                            <span>Unsuspend</span>
                        </button>
                    ) : isSelfUser ? (
                        <div
                            className="flex items-center gap-2 px-3 py-2 rounded text-text-muted opacity-40 cursor-not-allowed w-full text-left font-medium select-none"
                            title="Administrators cannot suspend their own account"
                        >
                            <UserX className={ICON_STYLE} />
                            <span>Suspend (Self)</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={(event) => onActionClick?.(event, 'suspend', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <UserX className={ICON_STYLE} />
                            <span>Suspend</span>
                        </button>
                    )}
                </>
            )}

            {resourceName === 'document_requests' && (
                <>
                    {isStaff ? (
                        isMultipleSelected ? (
                            openDocRequests.length > 0 ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'resolve', openDocRequests)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <CheckCircle2 className={ICON_STYLE} />
                                        <span>{`Resolve (${openDocRequests.length})`}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'reject', openDocRequests)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <XCircle className={ICON_STYLE} />
                                        <span>{`Reject (${openDocRequests.length})`}</span>
                                    </button>
                                </>
                            ) : null
                        ) : item.status === constants.DOCUMENT_REQUESTS_STATUS.OPEN ? (
                            <>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'resolve', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <CheckCircle2 className={ICON_STYLE} />
                                    <span>Resolve Request</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'reject', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <XCircle className={ICON_STYLE} />
                                    <span>Reject Request</span>
                                </button>
                            </>
                        ) : null
                    ) : null}

                    {isStaff && !isMultipleSelected && <div className="h-px bg-surface-border my-1" />}

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

                    {(!isStaff || isMultipleSelected) && item.status === constants.DOCUMENT_REQUESTS_STATUS.OPEN && (
                        <>
                            {!isMultipleSelected && <div className="h-px bg-surface-border my-1" />}
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'delete', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Trash2 className={ICON_STYLE} />
                                <span>{isMultipleSelected ? `Delete (${selectedCount})` : 'Delete Request'}</span>
                            </button>
                        </>
                    )}
                </>
            )}

            {resourceName === 'coordinator_requests' && (
                <>
                    {isAdmin && (
                        isMultipleSelected ? (
                            pendingCoordRequests.length > 0 ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'approve', pendingCoordRequests)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <CheckCircle2 className={ICON_STYLE} />
                                        <span>{`Approve (${pendingCoordRequests.length})`}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'reject', pendingCoordRequests)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <XCircle className={ICON_STYLE} />
                                        <span>{`Reject (${pendingCoordRequests.length})`}</span>
                                    </button>
                                </>
                            ) : null
                        ) : item.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING ? (
                            <>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'approve', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <CheckCircle2 className={ICON_STYLE} />
                                    <span>Approve</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'reject', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <XCircle className={ICON_STYLE} />
                                    <span>Reject</span>
                                </button>
                                <div className="h-px bg-surface-border my-1" />
                            </>
                        ) : null
                    )}

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

                    {!isAdmin && item.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING && (
                        <>
                            {!isMultipleSelected && <div className="h-px bg-surface-border my-1" />}
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'delete', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Trash2 className={ICON_STYLE} />
                                <span>{isMultipleSelected ? `Delete (${selectedCount})` : 'Delete Request'}</span>
                            </button>
                        </>
                    )}
                </>
            )}

            {(resourceName === 'documents' || resourceName === 'archives' || resourceName === 'my_requests') && (() => {
                const targetType = isFolder ? 'Folder' : 'File';

                // MEMBER ROLE: Open, View Info, View Version, Download
                if (isMember) {
                    return (
                        <>
                            {!isMultipleSelected && (
                                <>
                                    {!isArchived && (
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

                                    <div className="h-px bg-surface-border my-1" />
                                </>
                            )}

                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'download', isMultipleSelected ? targetSelection : item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Download className={ICON_STYLE} />
                                <span>{isMultipleSelected ? `Download All (${selectedCount})` : `Download ${targetType}`}</span>
                            </button>
                        </>
                    );
                }

                // OFFICER ROLE: Approve/Unapprove + Reject, View Info, View Version/Content, Download
                if (isOfficer) {
                    const isPending = item.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
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

                            {isMultipleSelected ? (
                                approvedDocs.length === targetSelection.length ? (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'unapprove', approvedDocs)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <RotateCcw className={ICON_STYLE} />
                                        <span>{`Unapprove (${selectedCount})`}</span>
                                    </button>
                                ) : rejectedDocs.length === targetSelection.length ? (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'unreject', rejectedDocs)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <RotateCcw className={ICON_STYLE} />
                                        <span>{`Unreject (${selectedCount})`}</span>
                                    </button>
                                ) : pendingDocs.length === targetSelection.length ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'approve', pendingDocs)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Check className={ICON_STYLE} />
                                            <span>{`Approve (${selectedCount})`}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'reject', pendingDocs)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <XCircle className={ICON_STYLE} />
                                            <span>{`Reject (${selectedCount})`}</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {pendingDocs.length > 0 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(event) => onActionClick?.(event, 'approve', pendingDocs)}
                                                    className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                                >
                                                    <Check className={ICON_STYLE} />
                                                    <span>{`Approve Pending (${pendingDocs.length})`}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => onActionClick?.(event, 'reject', pendingDocs)}
                                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                                >
                                                    <XCircle className={ICON_STYLE} />
                                                    <span>{`Reject Pending (${pendingDocs.length})`}</span>
                                                </button>
                                            </>
                                        )}
                                        {approvedDocs.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={(event) => onActionClick?.(event, 'unapprove', approvedDocs)}
                                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                            >
                                                <RotateCcw className={ICON_STYLE} />
                                                <span>{`Unapprove Approved (${approvedDocs.length})`}</span>
                                            </button>
                                        )}
                                        {rejectedDocs.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={(event) => onActionClick?.(event, 'unreject', rejectedDocs)}
                                                className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                            >
                                                <RotateCcw className={ICON_STYLE} />
                                                <span>{`Unreject Rejected (${rejectedDocs.length})`}</span>
                                            </button>
                                        )}
                                    </>
                                )
                            ) : (() => {
                                const effStatus = getItemEffectiveStatus(item);
                                if (effStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED || effStatus === constants.DOCUMENT_SHARES_STATUS.STASHED) {
                                    return null;
                                }
                                if (effStatus === constants.DOCUMENT_SHARES_STATUS.REJECTED) {
                                    return (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'unreject', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <RotateCcw className={ICON_STYLE} />
                                            <span>{`Unreject ${targetType}`}</span>
                                        </button>
                                    );
                                }
                                if (effStatus === constants.DOCUMENT_SHARES_STATUS.APPROVED) {
                                    return (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'unapprove', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <RotateCcw className={ICON_STYLE} />
                                            <span>{`Unapprove ${targetType}`}</span>
                                        </button>
                                    );
                                }
                                return (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'approve', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Check className={ICON_STYLE} />
                                            <span>{`Approve ${targetType}`}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'reject', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <XCircle className={ICON_STYLE} />
                                            <span>{`Reject ${targetType}`}</span>
                                        </button>
                                    </>
                                );
                            })()}

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
                                </>
                            )}

                            <div className="h-px bg-surface-border my-1" />

                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'download', isMultipleSelected ? targetSelection : item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Download className={ICON_STYLE} />
                                <span>{isMultipleSelected ? `Download All (${selectedCount})` : `Download ${targetType}`}</span>
                            </button>
                        </>
                    );
                }

                // DIRECTOR ROLE: Publish/Unpublish + Stash/Unstash, View Info, View Version/Content, Download
                if (isDirector) {
                    const isStashed = item.status === constants.DOCUMENT_SHARES_STATUS.STASHED;
                    const isPublished = item.status === constants.DOCUMENT_SHARES_STATUS.PUBLISHED;

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

                            {isMultipleSelected ? (
                                publishedDocs.length === targetSelection.length ? (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'unpublish', publishedDocs)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-warning hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <EyeOff className={ICON_STYLE} />
                                        <span>{`Unpublish (${selectedCount})`}</span>
                                    </button>
                                ) : stashedDocs.length === targetSelection.length ? (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'unstash', stashedDocs)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <RotateCcw className={ICON_STYLE} />
                                        <span>{`Unstash (${selectedCount})`}</span>
                                    </button>
                                ) : unpublishedDocs.length === targetSelection.length ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'publish', unpublishedDocs)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Globe className={ICON_STYLE} />
                                            <span>{`Publish (${selectedCount})`}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'stash', unpublishedDocs)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Layers className={ICON_STYLE} />
                                            <span>{`Stash (${selectedCount})`}</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {publishedDocs.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={(event) => onActionClick?.(event, 'unpublish', publishedDocs)}
                                                className="flex items-center gap-2 px-3 py-2 rounded text-warning hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                            >
                                                <EyeOff className={ICON_STYLE} />
                                                <span>{`Unpublish Published (${publishedDocs.length})`}</span>
                                            </button>
                                        )}
                                        {unpublishedDocs.length > 0 && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={(event) => onActionClick?.(event, 'publish', unpublishedDocs)}
                                                    className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                                >
                                                    <Globe className={ICON_STYLE} />
                                                    <span>{`Publish (${unpublishedDocs.length})`}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => onActionClick?.(event, 'stash', unpublishedDocs)}
                                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                                >
                                                    <Layers className={ICON_STYLE} />
                                                    <span>{`Stash (${unpublishedDocs.length})`}</span>
                                                </button>
                                            </>
                                        )}
                                        {stashedDocs.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={(event) => onActionClick?.(event, 'unstash', stashedDocs)}
                                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                            >
                                                <RotateCcw className={ICON_STYLE} />
                                                <span>{`Unstash Stashed (${stashedDocs.length})`}</span>
                                            </button>
                                        )}
                                    </>
                                )
                            ) : isPublished ? (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'unpublish', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-warning hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <EyeOff className={ICON_STYLE} />
                                    <span>{`Unpublish ${targetType}`}</span>
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'publish', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Globe className={ICON_STYLE} />
                                        <span>{`Publish ${targetType}`}</span>
                                    </button>
                                    {isStashed ? (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'unstash', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <RotateCcw className={ICON_STYLE} />
                                            <span>{`Unstash ${targetType}`}</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'stash', item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Layers className={ICON_STYLE} />
                                            <span>{`Stash ${targetType}`}</span>
                                        </button>
                                    )}
                                </>
                            )}

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
                                </>
                            )}

                            <div className="h-px bg-surface-border my-1" />

                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'download', isMultipleSelected ? targetSelection : item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Download className={ICON_STYLE} />
                                <span>{isMultipleSelected ? `Download All (${selectedCount})` : `Download ${targetType}`}</span>
                            </button>
                        </>
                    );
                }

                // ADMIN & COORDINATOR (STAFF): Open, Share, View Info, View Content/Version, View Share, Edit, Archive/Unarchive, Delete
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

                        {!isArchived && (
                            isMultipleSelected ? (
                                unsharedDocs.length > 0 && sharedDocs.length > 0 ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'share', unsharedDocs)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Share2 className={ICON_STYLE} />
                                            <span>{`Share (${unsharedDocs.length})`}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'unshare', sharedDocs)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-warning hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <RotateCcw className={ICON_STYLE} />
                                            <span>{`Unshare (${sharedDocs.length})`}</span>
                                        </button>
                                    </>
                                ) : sharedDocs.length > 0 ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'unshare', sharedDocs)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-warning hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <RotateCcw className={ICON_STYLE} />
                                            <span>{`Unshare (${selectedCount})`}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'share', sharedDocs)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <Share2 className={ICON_STYLE} />
                                            <span>{`Share (${selectedCount})`}</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'share', unsharedDocs)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Share2 className={ICON_STYLE} />
                                        <span>{`Share (${selectedCount})`}</span>
                                    </button>
                                )
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={(event) => onActionClick?.(event, 'share', item)}
                                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                    >
                                        <Share2 className={ICON_STYLE} />
                                        <span>{`Share ${targetType}`}</span>
                                    </button>
                                    {isDocShared(item) && (
                                        <button
                                            type="button"
                                            onClick={(event) => onActionClick?.(event, 'unshare', isMultipleSelected ? targetSelection : item)}
                                            className="flex items-center gap-2 px-3 py-2 rounded text-warning hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                        >
                                            <RotateCcw className={ICON_STYLE} />
                                            <span>{isMultipleSelected ? `Unshare (${selectedCount})` : `Unshare ${targetType}`}</span>
                                        </button>
                                    )}
                                </>
                            )
                        )}

                        {!isMultipleSelected && (
                            <>
                                {!isArchived && <div className="h-px bg-surface-border my-1" />}

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

                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'view_share', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Share2 className={ICON_STYLE} />
                                    <span>View Share</span>
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

                        <button
                            type="button"
                            onClick={(event) => onActionClick?.(event, 'download', isMultipleSelected ? targetSelection : item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <Download className={ICON_STYLE} />
                            <span>{isMultipleSelected ? `Download All (${selectedCount})` : `Download ${targetType}`}</span>
                        </button>

                        <div className="h-px bg-surface-border my-1" />

                        {isArchived ? (
                            <>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'restore', isMultipleSelected ? targetSelection : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Archive className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Unarchive (${selectedCount})` : `Unarchive ${targetType}`}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'delete', isMultipleSelected ? targetSelection : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Trash2 className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Delete (${selectedCount})` : `Delete ${targetType}`}</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'archive', isMultipleSelected ? targetSelection : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Archive className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Archive (${selectedCount})` : `Archive ${targetType}`}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'delete', isMultipleSelected ? targetSelection : item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Trash2 className={ICON_STYLE} />
                                    <span>{isMultipleSelected ? `Delete (${selectedCount})` : `Delete ${targetType}`}</span>
                                </button>
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
