import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { userService, systemEventService } from '../services';
import { constants } from '../constants';
import { useAuthStore } from './useAuthStore';


// --- STORAGE HELPERS ---
const USER_PREV_STATUS_KEY = 'pamantasan_user_prev_status';

function savePreviousStatus(userId, status) {
    if (!userId || !status || status === 'SUSPENDED') return;
    try {
        const stored = JSON.parse(localStorage.getItem(USER_PREV_STATUS_KEY) || '{}');
        stored[userId] = status;
        localStorage.setItem(USER_PREV_STATUS_KEY, JSON.stringify(stored));
    } catch {
        // Ignore storage error
    }
}

function getStoredPreviousStatus(userId) {
    if (!userId) return null;
    try {
        const stored = JSON.parse(localStorage.getItem(USER_PREV_STATUS_KEY) || '{}');
        return stored[userId] || null;
    } catch {
        return null;
    }
}


// --- STORE ---
const useUserStore = create((set, get) => ({
    // STATES
    users: [],
    selectedUser: null,
    userCredentials: null,
    userSettings: null,
    userSessions: [],
    isLoading: false,
    error: null,

    // PREVIOUS STATUS
    getPreviousStatus: (userId) => {
        const stored = getStoredPreviousStatus(userId);
        if (stored) return stored;
        const user = get().users.find((item) => item?.id === userId);
        if (user?.status && user.status !== 'SUSPENDED') {
            return user.status;
        }
        return 'PENDING_PASSWORD';
    },

    // USERS
    fetchUsers: async () => {
        set({ isLoading: true, error: null });

        try {
            const users = await userService.fetchUsers();
            let resolvedUsers = (users || []).filter(Boolean);

            const currentUser = useAuthStore.getState().currentUser;
            if (currentUser && !resolvedUsers.some((u) => u.id === currentUser.id || u.universityId === currentUser.universityId)) {
                resolvedUsers = [currentUser, ...resolvedUsers];
            }

            set({ users: resolvedUsers, isLoading: false, error: null });

            return resolvedUsers;
        } catch {
            const currentUser = useAuthStore.getState().currentUser;
            const fallbackUsers = currentUser ? [currentUser] : [];
            set({ users: fallbackUsers, isLoading: false, error: null });

            return fallbackUsers;
        }
    },

    fetchUserById: async (id) => {
        set({ isLoading: true, error: null });

        try {
            let user = get().users.find((item) => item.id === id);

            if (!user) {
                user = await userService.fetchUserById(id);
            }

            set({ selectedUser: user, isLoading: false, error: null });

            return user;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch user with ID "${id}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    fetchUserByUniversityId: async (universityId) => {
        set({ isLoading: true, error: null });

        try {
            let user = get().users.find((item) => item.universityId === universityId);

            if (!user) {
                user = await userService.fetchUserByUniversityId(universityId);
            }

            set({ selectedUser: user, isLoading: false, error: null });

            return user;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch user with university ID "${universityId}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    fetchUserByEmail: async (email) => {
        set({ isLoading: true, error: null });

        try {
            let user = get().users.find((item) => item.email?.toLowerCase() === email?.toLowerCase());

            if (!user) {
                user = await userService.fetchUserByEmail(email);
            }

            set({ selectedUser: user, isLoading: false, error: null });

            return user;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch user with email "${email}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    insertUser: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const timestamp = new Date().toISOString();
            const payloadWithDates = {
                createdAt: timestamp,
                updatedAt: timestamp,
                ...payload,
            };
            const validatedPayload = mutationSchema.InsertUserSchema.parse(payloadWithDates);
            const result = await userService.insertUser(validatedPayload);

            const definedResult = Object.fromEntries(
                Object.entries(result || {}).filter(([, v]) => v !== undefined)
            );

            const newUser = {
                id: result?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`),
                ...validatedPayload,
                ...definedResult,
            };

            savePreviousStatus(newUser.id, newUser.status || 'PENDING_PASSWORD');

            set((state) => ({
                users: [...state.users.filter(Boolean), newUser],
                isLoading: false,
                error: null,
            }));

            get().fetchUsers().catch(() => {});

            systemEventService.recordSystemEvent({
                entityType: constants.AUDIT_LOGS_ENTITY_TYPE.USER,
                entityId: newUser.id,
                action: constants.AUDIT_LOGS_ACTION.CREATED,
                data: {
                    name: `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim() || newUser.email,
                    role: newUser.role,
                    email: newUser.email,
                },
                targetRoles: ['ADMINISTRATOR'],
                isMajor: true,
            }).catch(() => {});

            return newUser;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert user.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateUser: async (id, payload) => {
        set({ isLoading: true, error: null });

        try {
            const timestamp = new Date().toISOString();
            const payloadWithUpdate = {
                ...payload,
                updatedAt: payload?.updatedAt ?? timestamp,
            };
            const validatedPayload = mutationSchema.UpdateUserSchema.parse(payloadWithUpdate);
            const existingUser = get().users.find((item) => item?.id === id) ?? {};

            // Record previous status before suspension
            if (validatedPayload.status === 'SUSPENDED') {
                if (existingUser?.status && existingUser.status !== 'SUSPENDED') {
                    savePreviousStatus(id, existingUser.status);
                }
            } else if (validatedPayload.status) {
                savePreviousStatus(id, validatedPayload.status);
            }

            // Self-suspension guard: Admins cannot suspend themselves
            if (validatedPayload.status === 'SUSPENDED') {
                try {
                    const { useAuthStore } = await import('./useAuthStore');
                    const authUser = useAuthStore.getState().currentUser;
                    if (authUser && (authUser.id === id || (existingUser?.universityId && authUser.universityId === existingUser.universityId))) {
                        const message = 'Administrators cannot suspend their own account. Another administrator must perform this action.';
                        set({ isLoading: false, error: message });
                        throw new Error(message);
                    }
                } catch (err) {
                    if (err.message?.includes('cannot suspend their own account')) {
                        throw err;
                    }
                }
            }

            const result = await userService.updateUser(id, validatedPayload);

            const cleanResult = Object.fromEntries(
                Object.entries(result || {}).filter(([, v]) => v !== undefined)
            );
            const cleanPayload = Object.fromEntries(
                Object.entries(validatedPayload || {}).filter(([, v]) => v !== undefined)
            );

            const mergedUser = {
                ...existingUser,
                ...cleanPayload,
                ...cleanResult,
                id: id,
                updatedAt: validatedPayload.updatedAt ?? timestamp,
            };

            set((state) => ({
                users: state.users.map((item) =>
                    item?.id === id ? mergedUser : item
                ),
                selectedUser: state.selectedUser?.id === id
                    ? mergedUser
                    : state.selectedUser,
                isLoading: false,
                error: null,
            }));

            try {
                const { useAuthStore } = await import('./useAuthStore');
                const authUser = useAuthStore.getState().currentUser;
                if (authUser && (authUser.id === id || authUser.universityId === mergedUser.universityId)) {
                    useAuthStore.setState({ currentUser: { ...authUser, ...mergedUser } });
                }
            } catch (authErr) {
                console.warn('Failed to sync updated user with auth store:', authErr);
            }

            get().fetchUsers().catch(() => {});

            const isSuspended = validatedPayload.status === 'SUSPENDED';
            const isUnsuspended = existingUser?.status === 'SUSPENDED' && validatedPayload.status && validatedPayload.status !== 'SUSPENDED';
            let userAction = constants.AUDIT_LOGS_ACTION.UPDATED;
            if (isSuspended) userAction = constants.AUDIT_LOGS_ACTION.SUSPENDED;
            else if (isUnsuspended) userAction = constants.AUDIT_LOGS_ACTION.UNSUSPENDED;

            systemEventService.recordSystemEvent({
                entityType: constants.AUDIT_LOGS_ENTITY_TYPE.USER,
                entityId: id,
                action: userAction,
                data: {
                    name: `${mergedUser.firstName || ''} ${mergedUser.lastName || ''}`.trim() || mergedUser.email,
                    role: mergedUser.role,
                    status: mergedUser.status,
                },
                targetUserIds: [id],
                targetRoles: ['ADMINISTRATOR'],
                isMajor: isSuspended || isUnsuspended,
            }).catch(() => {});

            return mergedUser;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update user.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteUser: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await userService.deleteUser(id);

            if (isDeleted) {
                set((state) => ({
                    users: state.users.filter((item) => item.id !== id),
                    selectedUser: state.selectedUser?.id === id
                        ? null
                        : state.selectedUser,
                    isLoading: false,
                    error: null,
                }));

                systemEventService.recordSystemEvent({
                    entityType: constants.AUDIT_LOGS_ENTITY_TYPE.USER,
                    entityId: id,
                    action: constants.AUDIT_LOGS_ACTION.DELETED,
                    data: { id },
                    targetRoles: ['ADMINISTRATOR'],
                    isMajor: true,
                }).catch(() => {});
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete user.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // CREDENTIALS
    fetchUserCredentialsByUserId: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            const credentials = await userService.fetchUserCredentialsByUserId(userId);
            set({ userCredentials: credentials, isLoading: false, error: null });

            return credentials;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch credentials for user "${userId}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    insertUserCredential: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertUserCredentialSchema.parse(payload);
            const newCredential = await userService.insertUserCredential(validatedPayload);

            set({ userCredentials: newCredential, isLoading: false, error: null });
            return newCredential;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert user credential.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateUserCredential: async (userId, payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.UpdateUserCredentialSchema.parse(payload);
            const updatedCredential = await userService.updateUserCredential(userId, validatedPayload);

            set({ userCredentials: updatedCredential, isLoading: false, error: null });
            return updatedCredential;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update user credential.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteUserCredential: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await userService.deleteUserCredential(userId);

            if (isDeleted) {
                set({ userCredentials: null, isLoading: false, error: null });
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete user credential.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // SETTINGS
    fetchUserSettingsByUserId: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            const settings = await userService.fetchUserSettingsByUserId(userId);
            set({ userSettings: settings, isLoading: false, error: null });

            return settings;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch settings for user "${userId}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    insertUserSetting: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertUserSettingSchema.parse(payload);
            const newSetting = await userService.insertUserSetting(validatedPayload);

            set({ userSettings: newSetting, isLoading: false, error: null });
            return newSetting;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert user setting.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateUserSetting: async (userId, payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.UpdateUserSettingSchema.parse(payload);
            const updatedSetting = await userService.updateUserSetting(userId, validatedPayload);

            set({ userSettings: updatedSetting, isLoading: false, error: null });
            return updatedSetting;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update user setting.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteUserSetting: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await userService.deleteUserSetting(userId);

            if (isDeleted) {
                set({ userSettings: null, isLoading: false, error: null });
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete user setting.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    // SESSIONS
    fetchUserSessionsByUserId: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            const sessions = await userService.fetchUserSessionsByUserId(userId);
            set({ userSessions: sessions, isLoading: false, error: null });

            return sessions;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch sessions for user "${userId}".`;
            set({ isLoading: false, error: message });

            return [];
        }
    },

    insertUserSession: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedPayload = mutationSchema.InsertUserSessionSchema.parse(payload);
            const newSession = await userService.insertUserSession(validatedPayload);

            set((state) => ({
                userSessions: [...state.userSessions, newSession],
                isLoading: false,
                error: null,
            }));

            return newSession;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert user session.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteUserSession: async (id) => {
        set({ isLoading: true, error: null });

        try {
            const isDeleted = await userService.deleteUserSession(id);

            if (isDeleted) {
                set((state) => ({
                    userSessions: state.userSessions.filter((item) => item.id !== id),
                    isLoading: false,
                    error: null,
                }));
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete user session.';
            set({ isLoading: false, error: message });
            
            throw error;
        }
    },

    // CONTROLS
    setSelectedUser: (user) => {
        set({ selectedUser: user });
    },

    clearError: () => {
        set({ error: null });
    },
}));


// --- EXPORTS ---
export { useUserStore };
