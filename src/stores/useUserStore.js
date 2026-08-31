// --- IMPORTS ---
import { create } from 'zustand';
import {
    UserInsertSchema,
    UserUpdateSchema,
    UserSettingUpdateSchema,
    UserSessionInsertSchema,
} from '../schemas';
import {
    DEFAULT_THEME_MODE,
    DEFAULT_NOTIFICATION_SCOPE,
} from '../constants';
import { userService } from '../services';
import { useAuthenticationStore } from './useAuthenticationStore';

// --- STORE DEFINITION ---
const useUserStore = create((set, get) => ({
    // STATE
    users: [],
    userSettings: [],
    userSessions: [],
    selectedUser: null,
    isLoading: false,
    error: null,

    // 1. USERS CRUD ACTIONS
    fetchUsers: async (filterOptions = {}) => {
        set({ isLoading: true, error: null });

        try {
            const liveUsers = await userService.fetchUsers();
            let resultUsers = [...liveUsers];

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

            set({ users: liveUsers, isLoading: false });
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
            let user = get().users.find((item) => item.id === userId) ?? null;
            if (!user) {
                const allUsers = await userService.fetchUsers();
                user = allUsers.find((item) => item.id === userId) ?? null;
            }
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
            let user = get().users.find((item) => item.university_id === universityId) ?? null;
            if (!user) {
                user = await userService.fetchUserByUniversityId(universityId);
            }
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
            const created = await userService.createUser(validatedData);

            const newUser = created ?? {
                id: validatedData.id ?? `user-${Date.now()}`,
                university_id: validatedData.university_id,
                universityId: validatedData.university_id,
                first_name: validatedData.first_name,
                last_name: validatedData.last_name,
                middle_name: validatedData.middle_name ?? null,
                name: `${validatedData.first_name} ${validatedData.last_name}`,
                email: validatedData.email,
                role: validatedData.role ?? 'MEMBER',
                status: validatedData.status ?? 'VERIFIED',
                department_id: validatedData.department_id,
                avatar_path: validatedData.avatar_path ?? null,
            };

            set((state) => ({
                users: [...state.users, newUser],
                isLoading: false,
            }));

            return newUser;
        } catch (error) {
            const errorMessage =
                error?.issues?.[0]?.message ??
                error?.errors?.[0]?.message ??
                error?.message ??
                'Failed to create user account.';
            set({ isLoading: false, error: errorMessage });
            throw new Error(errorMessage, { cause: error });
        }
    },

    updateUser: async (userId, userUpdates) => {
        set({ isLoading: true, error: null });

        try {
            const validatedUpdates = UserUpdateSchema.parse(userUpdates);
            await userService.updateUser(userId, validatedUpdates);

            const updatedUser = {
                ...(get().users.find((item) => item.id === userId) ?? {}),
                ...validatedUpdates,
                id: userId,
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

            // Sync with current authenticated user session if editing own account
            const authUser = useAuthenticationStore.getState().currentUser;
            if (authUser?.id === userId || authUser?.university_id === updatedUser.university_id) {
                useAuthenticationStore.getState().updateProfile({
                    ...updatedUser,
                    avatar_path: updatedUser.avatar_path,
                    avatarPath: updatedUser.avatar_path,
                });
            }

            return updatedUser;
        } catch (error) {
            const errorMessage =
                error?.issues?.[0]?.message ??
                error?.errors?.[0]?.message ??
                error?.message ??
                'Failed to update user account.';
            set({ isLoading: false, error: errorMessage });
            throw new Error(errorMessage, { cause: error });
        }
    },

    deleteUser: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            await userService.deleteUser(userId);

            set((state) => ({
                users: state.users.filter((item) => item.id !== userId),
                selectedUser: state.selectedUser?.id === userId
                    ? null
                    : state.selectedUser,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete user account.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    // 2. USER SETTINGS ACTIONS
    fetchUserSettings: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            let settings = get().userSettings.find((item) => item.user_id === userId);
            if (!settings) {
                settings = {
                    user_id: userId,
                    theme: DEFAULT_THEME_MODE,
                    notification: DEFAULT_NOTIFICATION_SCOPE,
                };
            }
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
            const currentSettings = get().userSettings.find((item) => item.user_id === userId);

            const updatedSettings = {
                ...(currentSettings ?? { user_id: userId, theme: DEFAULT_THEME_MODE, notification: DEFAULT_NOTIFICATION_SCOPE }),
                ...validatedUpdates,
                user_id: userId,
                updated_at: new Date().toISOString(),
            };

            set((state) => ({
                userSettings: [
                    ...state.userSettings.filter((item) => item.user_id !== userId),
                    updatedSettings,
                ],
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
    recordUserSession: async (sessionPayload) => {
        try {
            const validatedSession = UserSessionInsertSchema.parse(sessionPayload);
            const newSession = {
                id: `sess-${Date.now()}`,
                ...validatedSession,
                created_at: new Date().toISOString(),
            };

            set((state) => ({
                userSessions: [...state.userSessions, newSession],
            }));

            return newSession;
        } catch (error) {
            console.warn('Session recording notice:', error);
            return null;
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
