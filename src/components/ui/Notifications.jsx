// --- IMPORTS ---
import { Bell } from 'lucide-react';
import { Container } from '../Container';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'absolute right-0 top-full mt-2 z-50 w-80 sm:w-96';

// --- COMPONENTS ---
const Notifications = ({
    isOpen = false,
    notifications = [],
    unreadCount = 0,
    onMarkAsRead,
    onMarkAllAsRead,
    className,
    ...props
}) => {
    // GUARD CLAUSES
    if (!isOpen) {
        return null;
    }

    // HANDLERS
    const handleMarkAsRead = (notificationId) => {
        onMarkAsRead?.(notificationId);
    };

    const handleMarkAllAsRead = () => {
        onMarkAllAsRead?.();
    };

    // DERIVED VALUES
    const composedClassName = `${BASE_STYLE} ${className ?? ''}`.trim();

    // RENDER
    return (
        <div
            className={composedClassName}
            {...props}
        >
            <Container
                variant="card"
                className="p-4 gap-3 bg-surface border-surface-border shadow-xl"
            >
                {/* HEADER */}
                <div className="flex items-center justify-between border-b border-surface-border pb-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text">
                            Notifications
                        </span>
                        {unreadCount > 0 && (
                            <span className="px-2 py-1 rounded-full text-xs bg-accent text-text-inverted font-medium">
                                {unreadCount} New
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="text-xs text-accent hover:underline cursor-pointer"
                    >
                        Mark all read
                    </button>
                </div>

                {/* NOTIFICATIONS LIST */}
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="text-center py-6 text-xs text-text-muted">
                            No notifications right now
                        </div>
                    ) : (
                        notifications.map((notification) => {
                            const actionType = (notification.action ?? '').toUpperCase();
                            const entityType = (notification.entityType ?? '').toUpperCase();
                            const iconStyle = actionType.includes('REJECT') || actionType.includes('DELETE') || actionType.includes('FAIL')
                                ? 'bg-error-background text-error'
                                : actionType.includes('PENDING') || actionType.includes('REQUEST') || actionType.includes('WARN')
                                ? 'bg-warning-background text-warning'
                                : actionType.includes('INFO') || actionType.includes('MESSAGE') || actionType.includes('COMMENT')
                                ? 'bg-information-background text-information'
                                : 'bg-accent-background text-accent';

                            let title = `${notification.action?.toLowerCase()?.replace(/_/g, ' ')}: ${notification.entityType}`;
                            if (entityType.includes('DOCUMENT_REQUEST')) {
                                if (actionType === 'CREATED') title = 'New Document Request submitted';
                                else if (actionType === 'RESOLVED') title = 'Document Request approved & resolved';
                                else if (actionType === 'REJECTED') title = 'Document Request rejected';
                                else if (actionType === 'ATTACHED') title = 'Clearance attachment uploaded';
                                else if (actionType === 'COMMENTED') title = 'New message in request thread';
                                else if (actionType === 'UPDATED') title = 'Document Request status updated';
                            } else if (entityType.includes('COORDINATOR_REQUEST')) {
                                if (actionType === 'PENDING_APPROVAL') title = 'Coordinator clearance request';
                                else if (actionType === 'APPROVED') title = 'Coordinator request approved';
                                else if (actionType === 'REJECTED') title = 'Coordinator request rejected';
                            } else if (entityType.includes('DOCUMENT_SHARE')) {
                                if (actionType === 'SHARED') title = 'Document shared with department';
                                else if (actionType === 'PUBLISHED') title = 'Document published to department';
                            } else if (entityType.includes('DOCUMENT')) {
                                if (actionType === 'UPLOADED') title = 'New document uploaded to repository';
                                else if (actionType === 'DELETED') title = 'Document deleted from repository';
                            } else if (entityType.includes('USER')) {
                                if (actionType === 'SUSPENDED') title = 'User account suspended';
                                else if (actionType === 'UNSUSPENDED') title = 'User account reactivated';
                            }

                            const actorName = notification.actor
                                ? `${notification.actor.firstName || ''} ${notification.actor.lastName || ''}`.trim() || notification.actor.name || null
                                : null;

                            const createdDate = notification.createdAt ? new Date(notification.createdAt) : null;
                            const isToday = createdDate && createdDate.toDateString() === new Date().toDateString();
                            const timeString = createdDate
                                ? isToday
                                    ? createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : createdDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : 'Recent';

                            return (
                                <div
                                    key={notification.id}
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                                        notification.isRead
                                            ? 'bg-surface border-surface-border opacity-70'
                                            : 'bg-surface-hover border-accent/40 shadow-xs'
                                    }`}
                                >
                                    <div className={`p-2 rounded-md ${iconStyle} shrink-0 mt-0.5`}>
                                        <Bell className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="font-semibold text-text truncate capitalize">
                                                {title}
                                            </span>
                                            {!notification.isRead && (
                                                <span className="h-2 w-2 rounded-full bg-accent shrink-0 animate-pulse" />
                                            )}
                                        </div>
                                        {actorName && (
                                            <span className="text-[11px] text-text-muted truncate mt-0.5">
                                                By {actorName}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-text-muted/80 mt-1">
                                            {timeString}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </Container>
        </div>
    );
};

// --- EXPORTS ---
export { Notifications };
