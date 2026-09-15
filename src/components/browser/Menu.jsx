// --- IMPORTS ---
import { createPortal } from 'react-dom';
import {
    Archive,
    CheckCircle2,
    Edit3,
    Eye,
    MessageSquare,
    Share2,
    Trash2,
    User,
    XCircle,
} from 'lucide-react';
import { Container } from '../Container';
import { constants } from '../../constants';
import { ICON_STYLE } from './common';


// --- COMPONENTS ---
const Menu = ({
    item,
    resourceName,
    anchorRect,
    onActionClick,
}) => {
    // GUARD CLAUSES
    if (!item || !anchorRect) {
        return null;
    }

    // DERIVED VALUES
    const isFolder = item.isFolder;
    const isArchived = item.isArchived || item.status === constants.DOCUMENT_SHARES_STATUS.STASHED;

    const estimatedDropdownHeight = 220;
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;

    const shouldOpenUpwards = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow;

    const topPosition = shouldOpenUpwards
        ? Math.max(8, anchorRect.top - estimatedDropdownHeight - 4)
        : Math.min(window.innerHeight - estimatedDropdownHeight - 8, anchorRect.bottom + 4);

    const rightPosition = Math.max(8, window.innerWidth - anchorRect.right);

    const dynamicStyle = {
        position: 'fixed',
        top: `${topPosition}px`,
        right: `${rightPosition}px`,
        zIndex: 9999,
    };

    // RENDER
    return createPortal(
        <Container
            variant="dropdown"
            style={dynamicStyle}
            onClick={(event) => event.stopPropagation()}
            className="animate-toast-in shadow-2xl min-w-48 text-xs select-none pointer-events-auto"
        >
            {resourceName === 'departments' && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Eye className={ICON_STYLE} />
                        <span>View Details</span>
                    </button>
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'edit', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Edit3 className={ICON_STYLE} />
                        <span>Edit Department</span>
                    </button>
                    <div className="h-px bg-surface-border my-1" />
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'delete', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Trash2 className={ICON_STYLE} />
                        <span>Delete Department</span>
                    </button>
                </>
            )}

            {resourceName === 'users' && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <User className={ICON_STYLE} />
                        <span>View Profile</span>
                    </button>
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'edit', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Edit3 className={ICON_STYLE} />
                        <span>Edit User & Role</span>
                    </button>
                    <div className="h-px bg-surface-border my-1" />
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'delete', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Trash2 className={ICON_STYLE} />
                        <span>Remove User</span>
                    </button>
                </>
            )}

            {resourceName === 'document_requests' && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <MessageSquare className={ICON_STYLE} />
                        <span>View Thread & Messages</span>
                    </button>
                    {item.status === 'OPEN' && (
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
                    )}
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
                    {item.status === 'PENDING' && (
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

            {(resourceName === 'documents' || resourceName === 'archives' || resourceName === 'my_requests') && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick?.(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Eye className={ICON_STYLE} />
                        <span>{isFolder ? 'Open Folder' : 'View Details'}</span>
                    </button>

                    {!isFolder && resourceName === 'documents' && (
                        <button
                            type="button"
                            onClick={(event) => onActionClick?.(event, 'share', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <Share2 className={ICON_STYLE} />
                            <span>Share / Publish</span>
                        </button>
                    )}

                    {!isFolder && item.status === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL && (
                        <button
                            type="button"
                            onClick={(event) => onActionClick?.(event, 'approve', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <CheckCircle2 className={ICON_STYLE} />
                            <span>Approve Document</span>
                        </button>
                    )}

                    {!isFolder && resourceName === 'documents' && (
                        <button
                            type="button"
                            onClick={(event) => onActionClick?.(event, 'comment', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <MessageSquare className={ICON_STYLE} />
                            <span>Comments & Notes</span>
                        </button>
                    )}

                    <div className="h-px bg-surface-border my-1" />

                    {isArchived ? (
                        <>
                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'restore', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Archive className={ICON_STYLE} />
                                <span>Restore to Active</span>
                            </button>

                            <button
                                type="button"
                                onClick={(event) => onActionClick?.(event, 'delete', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Trash2 className={ICON_STYLE} />
                                <span>Permanent Delete</span>
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={(event) => onActionClick?.(event, 'archive', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <Archive className={ICON_STYLE} />
                            <span>Stash & Archive</span>
                        </button>
                    )}
                </>
            )}
        </Container>,
        document.body
    );
};


// --- EXPORTS ---
export { Menu };
