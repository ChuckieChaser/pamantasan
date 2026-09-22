// --- IMPORTS ---
import { constants, isStaffRole, isAdminRole, isCoordinatorRole, isDirectorRole, isOfficerRole, isMemberRole } from '../constants';
import { useAuditStore } from '../stores/useAuditStore';
import { useNotificationStore } from '../stores/useNotificationStore';
import { useUserStore } from '../stores/useUserStore';
import { userService } from './userService';

// --- IN-MEMORY CACHE FOR READ DEBOUNCING ---
const recentReadCache = new Map(); // key: `${userId}:${documentId}` -> timestamp
const DEBOUNCE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// In-memory cache for user notification settings to avoid excessive queries
const userSettingsCache = new Map(); // userId -> { notification: 'ALL' | 'SYSTEM' | 'IMPORTANT', timestamp }
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- HELPERS ---
const isMajorAction = (entityType, action) => {
    const act = String(action || '').toUpperCase();
    const ent = String(entityType || '').toUpperCase();

    if (ent.includes('DOCUMENT_REQUEST')) {
        return ['CREATED', 'RESOLVED', 'REJECTED', 'ATTACHED', 'UPDATED'].includes(act);
    }
    if (ent.includes('COORDINATOR_REQUEST')) {
        return ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'].includes(act);
    }
    if (ent.includes('DOCUMENT_SHARE')) {
        return ['SHARED', 'PUBLISHED', 'APPROVED'].includes(act);
    }
    if (ent.includes('DOCUMENT')) {
        return ['DELETED', 'ARCHIVED'].includes(act);
    }
    if (ent.includes('USER')) {
        return ['CREATED', 'SUSPENDED', 'UNSUSPENDED'].includes(act);
    }
    if (ent.includes('DEPARTMENT')) {
        return ['CREATED', 'DELETED'].includes(act);
    }
    return false;
};

const resolveUserSettingNotification = async (userId) => {
    if (!userId) return constants.USER_SETTINGS_NOTIFICATION.IMPORTANT;
    const cached = userSettingsCache.get(userId);
    if (cached && Date.now() - cached.timestamp < SETTINGS_CACHE_TTL_MS) {
        return cached.notification;
    }

    try {
        const settings = await userService.fetchUserSettingsByUserId(userId);
        const preference = settings?.notification || constants.USER_SETTINGS_NOTIFICATION.IMPORTANT;
        userSettingsCache.set(userId, { notification: preference, timestamp: Date.now() });
        return preference;
    } catch {
        return constants.USER_SETTINGS_NOTIFICATION.IMPORTANT;
    }
};

// --- SERVICES ---
const systemEventService = {
    /**
     * Resolves target recipients based on roles, departments, and specific IDs.
     */
    resolveRecipientIds: ({
        targetRoles = [],
        targetDepartmentId = null,
        targetUserIds = [],
        actorId = null,
        excludeActor = true,
    }) => {
        const allUsers = useUserStore.getState().users || [];
        const recipientSet = new Set();

        // 1. Add direct target user IDs
        if (Array.isArray(targetUserIds)) {
            targetUserIds.forEach((id) => {
                if (id) recipientSet.add(String(id));
            });
        }

        // 2. Resolve target roles
        if (Array.isArray(targetRoles) && targetRoles.length > 0) {
            allUsers.forEach((user) => {
                if (!user?.id) return;

                const role = user.role;
                let matchesRole = false;

                for (const targetRole of targetRoles) {
                    const tr = String(targetRole).toUpperCase();
                    if (tr === 'RMO_STAFF' || tr === 'STAFF') {
                        if (isStaffRole(role)) matchesRole = true;
                    } else if (tr === 'ADMINISTRATOR' || tr === 'ADMIN') {
                        if (isAdminRole(role)) matchesRole = true;
                    } else if (tr === 'COORDINATOR' || tr === 'COORD') {
                        if (isCoordinatorRole(role)) matchesRole = true;
                    } else if (tr === 'DIRECTOR') {
                        if (isDirectorRole(role)) {
                            if (!targetDepartmentId || String(user.departmentId) === String(targetDepartmentId)) {
                                matchesRole = true;
                            }
                        }
                    } else if (tr === 'OFFICER') {
                        if (isOfficerRole(role)) {
                            if (!targetDepartmentId || String(user.departmentId) === String(targetDepartmentId)) {
                                matchesRole = true;
                            }
                        }
                    } else if (tr === 'MEMBER') {
                        if (isMemberRole(role)) {
                            if (!targetDepartmentId || String(user.departmentId) === String(targetDepartmentId)) {
                                matchesRole = true;
                            }
                        }
                    }
                }

                if (matchesRole) {
                    recipientSet.add(String(user.id));
                }
            });
        }

        // 3. Exclude actor if requested (default true so actors aren't spammed with their own actions)
        if (excludeActor && actorId) {
            recipientSet.delete(String(actorId));
        }

        return Array.from(recipientSet);
    },

    /**
     * Simultaneously creates an Audit Log entry and dispatches Notifications to affected parties.
     */
    recordSystemEvent: async ({
        actor = null,
        actorId = null,
        entityType,
        entityId,
        action,
        data = {},
        targetRoles = [],
        targetDepartmentId = null,
        targetUserIds = [],
        isMajor = null,
        excludeActor = true,
    }) => {
        const resolvedActorId = actorId || (typeof actor === 'object' ? actor?.id : actor) || null;
        const stringifiedData = typeof data === 'string' ? data : JSON.stringify(data);
        const resolvedIsMajor = isMajor !== null ? isMajor : isMajorAction(entityType, action);

        // 1. CREATE AUDIT LOG SIMULTANEOUSLY
        let auditLogEntry = null;
        try {
            const auditPayload = {
                actorId: resolvedActorId,
                entityType: entityType,
                entityId: String(entityId),
                action: action,
                data: stringifiedData,
                createdAt: new Date().toISOString(),
            };
            auditLogEntry = await useAuditStore.getState().insertAuditLog(auditPayload);
        } catch (error) {
            console.warn('[systemEventService] Audit log insertion warning (persisted locally):', error);
        }

        // 2. RESOLVE RECIPIENTS FOR NOTIFICATION
        const recipientIds = systemEventService.resolveRecipientIds({
            targetRoles,
            targetDepartmentId,
            targetUserIds,
            actorId: resolvedActorId,
            excludeActor,
        });

        // 3. DISPATCH NOTIFICATIONS TO ALL AFFECTED PARTIES
        const notificationPromises = recipientIds.map(async (recipientId) => {
            try {
                const notifPayload = {
                    recipientId: recipientId,
                    actorId: resolvedActorId,
                    entityType: entityType,
                    entityId: String(entityId),
                    action: action,
                    isRead: false,
                    isEmailed: false,
                    createdAt: new Date().toISOString(),
                };

                const inserted = await useNotificationStore.getState().insertNotification(notifPayload);

                // Check recipient email preference:
                // ALL => email & system notification
                // SYSTEM => system only notification
                // IMPORTANT => email on major events only
                const preference = await resolveUserSettingNotification(recipientId);
                const shouldSendEmail =
                    preference === constants.USER_SETTINGS_NOTIFICATION.ALL ||
                    (preference === constants.USER_SETTINGS_NOTIFICATION.IMPORTANT && resolvedIsMajor);

                if (shouldSendEmail) {
                    const parsedData = typeof data === 'object' ? data : {};
                    const allUsers = useUserStore.getState().users || [];
                    let recipientUser = allUsers.find((u) => String(u.id) === String(recipientId));
                    if (!recipientUser?.email) {
                        try {
                            recipientUser = await userService.fetchUserById(recipientId);
                        } catch {
                            /* ignore */
                        }
                    }

                    const toEmail = recipientUser?.email;
                    if (toEmail) {
                        const actorUser = allUsers.find((u) => String(u.id) === String(resolvedActorId));
                        const actorName = actorUser
                            ? `${actorUser.firstName || ''} ${actorUser.lastName || ''}`.trim() || actorUser.name || 'System'
                            : 'System';
                        const recipientName = recipientUser
                            ? `${recipientUser.firstName || ''} ${recipientUser.lastName || ''}`.trim() || recipientUser.name || 'User'
                            : 'User';
                        const title = parsedData.title || parsedData.subject || `${action.replace(/_/g, ' ')}: ${entityType}`;
                        const message = parsedData.description || parsedData.message || parsedData.reason || `Event ${action} on ${entityType}`;

                        useNotificationStore.getState().dispatchNotificationEmail({
                            toEmail,
                            recipientId,
                            recipientName,
                            actorId: resolvedActorId,
                            actorName,
                            entityType,
                            entityId,
                            action,
                            title,
                            message,
                            description: message,
                        }).catch(() => {});
                    }
                }

                return inserted;
            } catch (err) {
                console.warn(`[systemEventService] Notification dispatch failed for ${recipientId}:`, err);
                return null;
            }
        });

        const notifications = await Promise.allSettled(notificationPromises);

        return {
            auditLog: auditLogEntry,
            recipientCount: recipientIds.length,
            notifications,
        };
    },

    /**
     * Records a document read / view event.
     * Uses session debouncing (10-min window per user:doc) to prevent database spam.
     */
    recordDocumentRead: async ({ document, user, version = null }) => {
        if (!document?.id || !user?.id) return null;

        const docId = String(document.id);
        const userId = String(user.id);
        const cacheKey = `${userId}:${docId}`;
        const lastRead = recentReadCache.get(cacheKey);

        // Check if recently read in this session
        if (lastRead && Date.now() - lastRead < DEBOUNCE_WINDOW_MS) {
            return null;
        }

        recentReadCache.set(cacheKey, Date.now());

        const docTitle = document.name || document.title || 'Institutional Document';
        const departmentId = user.departmentId || document.departmentId || null;

        try {
            const auditPayload = {
                actorId: userId,
                entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DOCUMENT,
                entityId: docId,
                action: 'READ',
                data: JSON.stringify({
                    title: docTitle,
                    departmentId: departmentId,
                    role: user.role || constants.USERS_ROLE.MEMBER,
                    version: version || document.currentVersion || 1,
                    timestamp: new Date().toISOString(),
                }),
                createdAt: new Date().toISOString(),
            };

            const auditLog = await useAuditStore.getState().insertAuditLog(auditPayload);
            return auditLog;
        } catch (error) {
            console.warn('[systemEventService] Read log recording warning:', error);
            return null;
        }
    },
};

// --- EXPORTS ---
export { systemEventService };
export default systemEventService;
