// --- USE USER HOOK ---
import { useCallback } from 'react';
import { useUserStore } from '../userStore';


// --- HOOK ---

export const useUser = () => {
    const users = useUserStore((s) => s.users);
    const selectedUser = useUserStore((s) => s.selectedUser);
    const isLoading = useUserStore((s) => s.isLoading);
    const isMutating = useUserStore((s) => s.isMutating);
    const error = useUserStore((s) => s.error);

    const fetchUsers = useUserStore((s) => s.fetchUsers);
    const fetchUsersByDepartmentId = useUserStore((s) => s.fetchUsersByDepartmentId);
    const fetchUserById = useUserStore((s) => s.fetchUserById);
    const fetchUserByUniversityId = useUserStore((s) => s.fetchUserByUniversityId);
    const fetchUserByEmail = useUserStore((s) => s.fetchUserByEmail);
    const createUser = useUserStore((s) => s.createUser);
    const updateUser = useUserStore((s) => s.updateUser);
    const updateUsers = useUserStore((s) => s.updateUsers);
    const fetchUserCredential = useUserStore((s) => s.fetchUserCredential);
    const updateUserCredential = useUserStore((s) => s.updateUserCredential);
    const fetchUserSetting = useUserStore((s) => s.fetchUserSetting);
    const updateUserSetting = useUserStore((s) => s.updateUserSetting);
    const fetchUserSessions = useUserStore((s) => s.fetchUserSessions);
    const deleteUserSessions = useUserStore((s) => s.deleteUserSessions);
    const setSelectedUser = useUserStore((s) => s.setSelectedUser);
    const clearError = useUserStore((s) => s.clearError);
    const reset = useUserStore((s) => s.reset);


    // --- HANDLERS ---

    const handleFetchUsers = useCallback(
        (filters) => fetchUsers(filters),
        [fetchUsers],
    );

    const handleFetchUserById = useCallback(
        (id) => fetchUserById(id),
        [fetchUserById],
    );

    const handleCreateUser = useCallback(
        (payload) => createUser(payload),
        [createUser],
    );

    const handleUpdateUser = useCallback(
        (id, payload) => updateUser(id, payload),
        [updateUser],
    );

    const handleUpdateUsers = useCallback(
        (ids, payload) => updateUsers(ids, payload),
        [updateUsers],
    );

    const handleUpdateCredential = useCallback(
        (userId, payload) => updateUserCredential(userId, payload),
        [updateUserCredential],
    );

    const handleUpdateSetting = useCallback(
        (userId, payload) => updateUserSetting(userId, payload),
        [updateUserSetting],
    );

    const handleDeleteSessions = useCallback(
        (ids) => deleteUserSessions(ids),
        [deleteUserSessions],
    );


    return {
        // State
        users,
        selectedUser,
        isLoading,
        isMutating,
        error,

        // Handlers
        handleFetchUsers,
        handleFetchUserById,
        handleCreateUser,
        handleUpdateUser,
        handleUpdateUsers,
        handleUpdateCredential,
        handleUpdateSetting,
        handleDeleteSessions,

        // Direct access (for complex flows)
        fetchUsersByDepartmentId,
        fetchUserByUniversityId,
        fetchUserByEmail,
        fetchUserCredential,
        fetchUserSetting,
        fetchUserSessions,
        setSelectedUser,
        clearError,
        reset,
    };
};
