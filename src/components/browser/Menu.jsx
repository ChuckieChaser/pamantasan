// --- IMPORTS ---
import { useState, useRef, useLayoutEffect } from 'react';
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
import { useAuthStore } from '../../stores';
import { ICON_STYLE } from './common';


// --- COMPONENTS ---
const Menu = ({
    item,
    resourceName,
    anchorRect,
    onActionClick,
}) => {
    // REFS
    const menuRef = useRef(null);

    // STORES
    const currentUser = useAuthStore((state) => state.currentUser);

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
    }, [anchorRect, resourceName, item]);

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

    const dynamicStyle = {
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
    };

    // RENDER
    return createPortal(
        <Container
            ref={menuRef}
            variant="dropdown"
            style={dynamicStyle}
            onClick={(event) => event.stopPropagation()}
            className="animate-toast-in shadow-2xl min-w-48 text-xs select-none pointer-events-auto"
        >
            {resourceName === 'departments' && (
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
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'delete', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Trash2 className={ICON_STYLE} />
                        <span>Delete</span>
                    </button>
                </>
            )}

            {resourceName === 'users' && (
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
                    {item.status === constants.USERS_STATUS.SUSPENDED ? (
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
                        item.status === constants.DOCUMENT_REQUESTS_STATUS.OPEN ? (
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
                        ) : (
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'open_request', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <RotateCcw className={ICON_STYLE} />
                                <span>Open Request</span>
                            </button>
                        )
                    ) : null}

                    {isStaff && <div className="h-px bg-surface-border my-1" />}

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

                    {!isStaff && (
                        <>
                            <div className="h-px bg-surface-border my-1" />
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'delete', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Trash2 className={ICON_STYLE} />
                                <span>Delete Request</span>
                            </button>
                        </>
                    )}
                </>
            )}

            {resourceName === 'coordinator_requests' && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Eye className={ICON_STYLE} />
                        <span>Review Payload Details</span>
                    </button>
                    {isAdmin && item.status === constants.COORDINATOR_REQUESTS_STATUS.PENDING && (
                        <>
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'approve', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <CheckCircle2 className={ICON_STYLE} />
                                <span>Approve Request</span>
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
                    )}
                    {!isAdmin && (
                        <>
                            <div className="h-px bg-surface-border my-1" />
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'delete', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Trash2 className={ICON_STYLE} />
                                <span>Delete Request</span>
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

                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'download', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Download className={ICON_STYLE} />
                                <span>{`Download ${targetType}`}</span>
                            </button>
                        </>
                    );
                }

                // OFFICER ROLE: Approve/Unapprove + Reject, View Info, View Version/Content, Download
                if (isOfficer) {
                    const isPending = item.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
                    return (
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

                            {isPending ? (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'approve', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Check className={ICON_STYLE} />
                                    <span>{`Approve ${targetType}`}</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'unapprove', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <RotateCcw className={ICON_STYLE} />
                                    <span>{`Unapprove ${targetType}`}</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'reject', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <XCircle className={ICON_STYLE} />
                                <span>{`Reject ${targetType}`}</span>
                            </button>

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

                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'download', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Download className={ICON_STYLE} />
                                <span>{`Download ${targetType}`}</span>
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

                            {isPublished ? (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'unpublish', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-warning hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <EyeOff className={ICON_STYLE} />
                                    <span>{`Unpublish ${targetType}`}</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'publish', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Globe className={ICON_STYLE} />
                                    <span>{`Publish ${targetType}`}</span>
                                </button>
                            )}

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

                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'download', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Download className={ICON_STYLE} />
                                <span>{`Download ${targetType}`}</span>
                            </button>
                        </>
                    );
                }

                // ADMIN & COORDINATOR (STAFF): Open, Share, View Info, View Content/Version, View Share, Edit, Archive/Unarchive, Delete — NO Download
                return (
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

                        {!isArchived && (
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'share', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Share2 className={ICON_STYLE} />
                                <span>{`Share ${targetType}`}</span>
                            </button>
                        )}

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

                        <button
                            type="button"
                            onClick={(event) => onActionClick?.(event, 'download', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <Download className={ICON_STYLE} />
                            <span>{`Download ${targetType}`}</span>
                        </button>

                        <div className="h-px bg-surface-border my-1" />

                        {isArchived ? (
                            <>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'restore', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Archive className={ICON_STYLE} />
                                    <span>{`Unarchive ${targetType}`}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'delete', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Trash2 className={ICON_STYLE} />
                                    <span>{`Delete ${targetType}`}</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'archive', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Archive className={ICON_STYLE} />
                                    <span>{`Archive ${targetType}`}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={(event) => onActionClick?.(event, 'delete', item)}
                                    className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                                >
                                    <Trash2 className={ICON_STYLE} />
                                    <span>{`Delete ${targetType}`}</span>
                                </button>
                            </>
                        )}
                    </>
                );
            })()}
        </Container>,
        document.body
    );
};


// --- EXPORTS ---
export { Menu };
