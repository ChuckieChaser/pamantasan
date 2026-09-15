// --- IMPORTS ---
import { Bell } from 'lucide-react';
import { Container } from '../../components';

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
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="text-center py-6 text-xs text-text-muted">
                            No notifications right now
                        </div>
                    ) : (
                        notifications.map((notification) => {
                            const actionType = (notification.action ?? '').toUpperCase();
                            const iconStyle = actionType.includes('REJECT') || actionType.includes('DELETE') || actionType.includes('FAIL')
                                ? 'bg-error-background text-error'
                                : actionType.includes('PENDING') || actionType.includes('REQUEST') || actionType.includes('WARN')
                                ? 'bg-warning-background text-warning'
                                : actionType.includes('INFO') || actionType.includes('MESSAGE')
                                ? 'bg-information-background text-information'
                                : 'bg-accent-background text-accent';

                            return (
                                <div
                                    key={notification.id}
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    className={`flex items-start gap-3 p-2 rounded-lg border transition-colors cursor-pointer text-xs ${
                                        notification.is_read
                                            ? 'bg-surface border-surface-border opacity-70'
                                            : 'bg-surface-hover border-accent/30'
                                    }`}
                                >
                                    <div className={`p-2 rounded-md ${iconStyle} shrink-0 mt-1`}>
                                        <Bell className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="font-semibold text-text truncate capitalize">
                                                {notification.action?.toLowerCase()?.replace('_', ' ')}: {notification.entity_type}
                                            </span>
                                            {!notification.is_read && (
                                                <span className="h-2 w-2 rounded-full bg-accent shrink-0" />
                                            )}
                                        </div>
                                        <span className="text-text-muted line-clamp-2 mt-1">
                                            Entity: {notification.entity_id}
                                        </span>
                                        <span className="text-xs text-text-muted mt-1">
                                            {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
