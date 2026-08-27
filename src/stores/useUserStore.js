// --- IMPORTS ---
import { create } from 'zustand';
import {
    UserInsertSchema,
    UserUpdateSchema,
    UserSettingInsertSchema,
    UserSettingUpdateSchema,
    UserSessionInsertSchema,
} from '../schemas';
import {
    USER_ROLES,
    USER_STATUSES,
    DEFAULT_THEME_MODE,
    DEFAULT_NOTIFICATION_SCOPE,
} from '../constants';
import { MOCK_USERS } from '../mocks';

// --- CONFIGURATIONS ---
const INITIAL_USER_SETTINGS = MOCK_USERS.map((user) => ({
    user_id: user.id,
    theme: (user.id.endsWith('2') || user.id.endsWith('4') || user.id.endsWith('7'))
        ? 'DARK'
        : DEFAULT_THEME_MODE,
    notification: DEFAULT_NOTIFICATION_SCOPE,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
}));

// --- STORE DEFINITION ---
const useUserStore = create((set, get) => ({
    // STATE
    users: MOCK_USERS,
    userSettings: INITIAL_USER_SETTINGS,
    userSessions: [],
    selectedUser: null,
    isLoading: false,
    error: null,

    // 1. USERS CRUD ACTIONS
    fetchUsers: async (filterOptions = {}) => {
        set({ isLoading: true, error: null });

        try {
            let resultUsers = [...get().users];

            if (filterOptions.departmentId) {
                resultUsers = resultUsers.filter(
                    (user) => user.department_id === filterOptions.departmentId
                );
            }

            if (filterOptions.role) {
                resultUsers = resultUsers.filter(
                    (user) => user.role === filterOptions.role
                );
            }

            if (filterOptions.status) {
                resultUsers = resultUsers.filter(
                    (user) => user.status === filterOptions.status
                );
            }

            if (filterOptions.searchQuery) {
                const query = filterOptions.searchQuery.toLowerCase();
                resultUsers = resultUsers.filter((user) =>
                    user.first_name.toLowerCase().includes(query) ||
                    user.last_name.toLowerCase().includes(query) ||
                    user.university_id.toLowerCase().includes(query) ||
                    user.email.toLowerCase().includes(query)
                );
            }

            set({ isLoading: false });
            return resultUsers;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch users.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    fetchUserById: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            const user = get().users.find((item) => item.id === userId) ?? null;
            set({ selectedUser: user, isLoading: false });
            return user;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch user by identifier.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    fetchUserByUniversityId: async (universityId) => {
        set({ isLoading: true, error: null });

        try {
            const user = get().users.find((item) => item.university_id === universityId) ?? null;
            set({ selectedUser: user, isLoading: false });
            return user;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch user by University ID.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createUser: async (userPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = UserInsertSchema.parse(userPayload);
            const timestamp = new Date().toISOString();

            const newUserId = validatedData.id ?? `f${Date.now().toString(16).padStart(7, '0')}-0000-4000-8000-000000000000`.slice(0, 36);

            const newUser = {
                id: newUserId,
                university_id: validatedData.university_id,
                department_id: validatedData.department_id,
                role: validatedData.role,
                email: validatedData.email,
                avatar_path: validatedData.avatar_path ?? null,
                first_name: validatedData.first_name,
                middle_name: validatedData.middle_name ?? null,
                last_name: validatedData.last_name,
                status: validatedData.status ?? USER_STATUSES.PENDING_PASSWORD,
                created_at: timestamp,
                updated_at: timestamp,
            };

            // Enforce Unique Constraints on university_id & email
            const isDuplicate = get().users.some(
                (item) => item.university_id === newUser.university_id ||
                          item.email.toLowerCase() === newUser.email.toLowerCase()
            );

            if (isDuplicate) {
                throw new Error(`A user with University ID "${newUser.university_id}" or email "${newUser.email}" already exists.`);
            }

            // Auto initialize user settings matching trigger_initialize_user_data
            const defaultSettings = {
                user_id: newUserId,
                theme: DEFAULT_THEME_MODE,
                notification: DEFAULT_NOTIFICATION_SCOPE,
                created_at: timestamp,
                updated_at: timestamp,
            };

            set((state) => ({
                users: [...state.users, newUser],
                userSettings: [...state.userSettings, defaultSettings],
                isLoading: false,
            }));

            return newUser;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create user record.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    updateUser: async (userId, userUpdates) => {
        set({ isLoading: true, error: null });

        try {
            const validatedUpdates = UserUpdateSchema.parse(userUpdates);
            const targetUser = get().users.find((item) => item.id === userId);

            if (!targetUser) {
                throw new Error(`User with identifier "${userId}" was not found.`);
            }

            const updatedUser = {
                ...targetUser,
                ...validatedUpdates,
                updated_at: new Date().toISOString(),
            };

            set((state) => ({
                users: state.users.map((item) =>
                    item.id === userId ? updatedUser : item
                ),
                selectedUser: state.selectedUser?.id === userId
                    ? updatedUser
                    : state.selectedUser,
                isLoading: false,
            }));

            return updatedUser;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update user record.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    deleteUser: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                users: state.users.filter((item) => item.id !== userId),
                userSettings: state.userSettings.filter((item) => item.user_id !== userId),
                userSessions: state.userSessions.filter((item) => item.user_id !== userId),
                selectedUser: state.selectedUser?.id === userId
                    ? null
                    : state.selectedUser,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete user record.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    // 2. USER SETTINGS ACTIONS
    fetchUserSettings: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            const settings = get().userSettings.find((item) => item.user_id === userId) ?? null;
            set({ isLoading: false });
            return settings;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch user settings.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    updateUserSettings: async (userId, settingUpdates) => {
        set({ isLoading: true, error: null });

        try {
            const validatedUpdates = UserSettingUpdateSchema.parse(settingUpdates);
            const existingSettings = get().userSettings.find((item) => item.user_id === userId);

            const updatedSettings = existingSettings
                ? {
                      ...existingSettings,
                      ...validatedUpdates,
                      updated_at: new Date().toISOString(),
                  }
                : {
                      user_id: userId,
                      theme: validatedUpdates.theme ?? DEFAULT_THEME_MODE,
                      notification: validatedUpdates.notification ?? DEFAULT_NOTIFICATION_SCOPE,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                  };

            set((state) => ({
                userSettings: state.userSettings.some((item) => item.user_id === userId)
                    ? state.userSettings.map((item) => item.user_id === userId ? updatedSettings : item)
                    : [...state.userSettings, updatedSettings],
                isLoading: false,
            }));

            return updatedSettings;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update user settings.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    // 3. USER SESSIONS ACTIONS
    fetchUserSessions: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            const sessions = get().userSessions.filter((item) => item.user_id === userId);
            set({ isLoading: false });
            return sessions;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch user sessions.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createUserSession: async (sessionPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = UserSessionInsertSchema.parse(sessionPayload);
            const timestamp = new Date().toISOString();

            const newSession = {
                id: validatedData.id ?? `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                user_id: validatedData.user_id,
                token_hash: validatedData.token_hash,
                ip_address: validatedData.ip_address ?? null,
                user_agent: validatedData.user_agent ?? null,
                created_at: timestamp,
                expired_at: validatedData.expired_at ?? null,
            };

            set((state) => ({
                userSessions: [...state.userSessions, newSession],
                isLoading: false,
            }));

            return newSession;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create user session.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    deleteUserSession: async (sessionId) => {
        set({ isLoading: true, error: null });

        try {
            set((state) => ({
                userSessions: state.userSessions.filter((item) => item.id !== sessionId),
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete user session.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    setSelectedUser: (user) => {
        set({ selectedUser: user });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export {
    useUserStore,
};

export default useUserStore;
