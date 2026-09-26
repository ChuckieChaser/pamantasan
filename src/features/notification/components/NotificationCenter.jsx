// --- IMPORTS ---
import { useEffect } from 'react';
import { Bell, Check, CheckCheck, Clock, Info, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { useNotification } from '../hooks/useNotification';


// --- COMPONENTS ---
export const NotificationCenter = ({ recipientId }) => {
    // --- HOOKS & STATE ---
    const {
        notifications,
        unreadCount,
        hasUnread,
        isLoading,
        handleGetNotifications,
        handleMarkAsRead,
        handleMarkAllAsRead,
    } = useNotification();

    useEffect(() => {
        if (recipientId) {
            handleGetNotifications({ recipientId });
        }
    }, [recipientId, handleGetNotifications]);

    // --- RENDER ---
    return (
        <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-surface-border">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text">Notifications</h3>
                    {hasUnread && (
                        <Badge variant="accent" size="sm">
                            {unreadCount} unread
                        </Badge>
                    )}
                </div>

                {hasUnread && (
                    <Button
                        variant="ghost"
                        size="sm"
                        leadingIcon={CheckCheck}
                        label="Mark all read"
                        onClick={handleMarkAllAsRead}
                    />
                )}
            </div>

            {/* List Viewport */}
            {isLoading && (!notifications || notifications.length === 0) ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2">
                    <LoadingSpinner size="md" />
                    <span className="text-xs text-text-muted">Loading notifications...</span>
                </div>
            ) : (!notifications || notifications.length === 0) ? (
                <div className="py-16 text-center rounded-xl border border-dashed border-surface-border p-6 flex flex-col items-center justify-center gap-2">
                    <Bell className="h-8 w-8 text-text-muted opacity-40" />
                    <span className="text-sm font-semibold text-text">No notifications</span>
                    <span className="text-xs text-text-muted">You are all caught up on system notices and alerts.</span>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {notifications.map((item) => (
                        <Card
                            key={item.id}
                            variant={item.isRead ? 'flat' : 'interactive'}
                            padding="sm"
                            onClick={() => !item.isRead && handleMarkAsRead(item.id)}
                            className={`flex-row items-start gap-3 transition-colors ${
                                item.isRead ? 'opacity-70 bg-surface/40' : 'bg-surface border-accent/40 shadow-xs'
                            }`}
                        >
                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                item.isRead ? 'bg-surface-hover text-text-muted' : 'bg-accent-background text-accent'
                            }`}>
                                <Info className="h-4 w-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-xs font-semibold text-text truncate">
                                        {item.title}
                                    </h4>
                                    <span className="text-[10px] text-text-muted shrink-0 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                                    </span>
                                </div>

                                <p className="text-xs text-text-muted mt-0.5 leading-relaxed break-words">
                                    {item.message}
                                </p>
                            </div>

                            {!item.isRead && (
                                <span className="h-2 w-2 rounded-full bg-accent shrink-0 mt-1.5" />
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
