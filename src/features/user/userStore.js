// --- USER STORE ---
import { create } from 'zustand';
import {
    getUsers,
    getUsersByDepartmentId,
    getUserById,
    getUserByUniversityId,
    getUserByEmail,
    createUser,
    updateUser,
    updateUsers,
    getUserCredentialByUserId,
    updateUserCredential,
    getUserSettingByUserId,
    updateUserSetting,
    getUserSessionsByUserId,
    createUserSession,
    updateUserSession,
    deleteUserSessions,
} from './userService';


// --- STORE ---

export const useUserStore = create((set, get) => ({
    // --- STATE ---
    users: [],
    selectedUser: null,
    isLoading: false,
    isMutating: false,
    error: null,


    // --- QUERIES ---

    fetchUsers: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const users = await getUsers(filters);
            set({ users, isLoading: false });
            return users;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch users.' });
            return [];
        }
    },

    fetchUsersByDepartmentId: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const users = await getUsersByDepartmentId(filters);
            set({ users, isLoading: false });
            return users;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch department users.' });
            return [];
        }
    },

    fetchUserById: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const cached = get().users.find((u) => u?.id === id);
            const user = cached ?? await getUserById(id);
            set({ selectedUser: user, isLoading: false });
            return user;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch user.' });
            return null;
        }
    },

    fetchUserByUniversityId: async (universityId) => {
        set({ isLoading: true, error: null });
        try {
            const user = await getUserByUniversityId(universityId);
            set({ selectedUser: user, isLoading: false });
            return user;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch user by university ID.' });
            return null;
        }
    },

    fetchUserByEmail: async (email) => {
        set({ isLoading: true, error: null });
        try {
            const user = await getUserByEmail(email);
            set({ selectedUser: user, isLoading: false });
            return user;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch user by email.' });
            return null;
        }
    },


    // --- MUTATIONS ---

    createUser: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const user = await createUser(payload);
            set((state) => ({
                users: user ? [user, ...state.users] : state.users,
                isMutating: false,
            }));
            return user;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create user.' });
            throw error;
        }
    },

    updateUser: async (id, payload) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateUser(id, payload);
            set((state) => ({
                users: state.users.map((u) => (u?.id === id ? { ...u, ...updated } : u)),
                selectedUser: state.selectedUser?.id === id ? { ...state.selectedUser, ...updated } : state.selectedUser,
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update user.' });
            throw error;
        }
    },

    updateUsers: async (ids, payload) => {
        set({ isMutating: true, error: null });
        try {
            const result = await updateUsers(ids, payload);
            // Refetch to reflect bulk changes
            await get().fetchUsers();
            set({ isMutating: false });
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update users.' });
            throw error;
        }
    },


    // --- CREDENTIALS ---

    fetchUserCredential: async (userId) => {
        try {
            return await getUserCredentialByUserId(userId);
        } catch (error) {
            set({ error: error?.message ?? 'Failed to fetch user credential.' });
            return null;
        }
    },

    updateUserCredential: async (userId, payload) => {
        set({ isMutating: true, error: null });
        try {
            const result = await updateUserCredential(userId, payload);
            set({ isMutating: false });
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update user credential.' });
            throw error;
        }
    },


    // --- SETTINGS ---

    fetchUserSetting: async (userId) => {
        try {
            return await getUserSettingByUserId(userId);
        } catch (error) {
            set({ error: error?.message ?? 'Failed to fetch user settings.' });
            return null;
        }
    },

    updateUserSetting: async (userId, payload) => {
        set({ isMutating: true, error: null });
        try {
            const result = await updateUserSetting(userId, payload);
            set({ isMutating: false });
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update user settings.' });
            throw error;
        }
    },


    // --- SESSIONS ---

    fetchUserSessions: async (userId) => {
        try {
            return await getUserSessionsByUserId(userId);
        } catch (error) {
            set({ error: error?.message ?? 'Failed to fetch user sessions.' });
            return [];
        }
    },

    createUserSession: async (payload) => {
        try {
            return await createUserSession(payload);
        } catch (error) {
            set({ error: error?.message ?? 'Failed to create user session.' });
            throw error;
        }
    },

    updateUserSession: async (id, expiredAt) => {
        try {
            return await updateUserSession(id, expiredAt);
        } catch (error) {
            set({ error: error?.message ?? 'Failed to update user session.' });
            throw error;
        }
    },

    deleteUserSessions: async (ids) => {
        try {
            return await deleteUserSessions(ids);
        } catch (error) {
            set({ error: error?.message ?? 'Failed to delete user sessions.' });
            throw error;
        }
    },


    // --- CONTROLS ---

    setSelectedUser: (user) => set({ selectedUser: user }),

    clearError: () => set({ error: null }),

    reset: () => set({ users: [], selectedUser: null, isLoading: false, isMutating: false, error: null }),
}));
