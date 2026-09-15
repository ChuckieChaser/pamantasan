// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { userService } from '../services';


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

    // USERS
    fetchUsers: async () => {
        set({ isLoading: true, error: null });

        try {
            const users = await userService.fetchUsers();
            set({ users: (users || []).filter(Boolean), isLoading: false, error: null });

            return users;
        } catch (error) {
            const message = error?.message ?? 'Failed to fetch users.';
            set({ isLoading: false, error: message });

            return [];
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
            const validatedPayload = mutationSchema.InsertUserSchema.parse(payload);
            const newUser = await userService.insertUser(validatedPayload);

            set((state) => ({
                users: [...state.users.filter(Boolean), newUser].filter(Boolean),
                isLoading: false,
                error: null,
            }));

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
            const validatedPayload = mutationSchema.UpdateUserSchema.parse(payload);
            const updatedUser = await userService.updateUser(id, validatedPayload);

            set((state) => ({
                users: state.users.map((item) =>
                    item.id === id ? updatedUser : item
                ),
                selectedUser: state.selectedUser?.id === id
                    ? updatedUser
                    : state.selectedUser,
                isLoading: false,
                error: null,
            }));

            return updatedUser;
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
