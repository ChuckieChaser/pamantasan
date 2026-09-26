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

    const getUsers = useUserStore((s) => s.getUsers);
    const getUsersByDepartmentId = useUserStore((s) => s.getUsersByDepartmentId);
    const getUserById = useUserStore((s) => s.getUserById);
    const getUserByUniversityId = useUserStore((s) => s.getUserByUniversityId);
    const getUserByEmail = useUserStore((s) => s.getUserByEmail);
    const createUser = useUserStore((s) => s.createUser);
    const updateUser = useUserStore((s) => s.updateUser);
    const updateUsers = useUserStore((s) => s.updateUsers);
    const getUserCredentialByUserId = useUserStore((s) => s.getUserCredentialByUserId);
    const updateUserCredential = useUserStore((s) => s.updateUserCredential);
    const getUserSettingByUserId = useUserStore((s) => s.getUserSettingByUserId);
    const updateUserSetting = useUserStore((s) => s.updateUserSetting);
    const getUserSessionsByUserId = useUserStore((s) => s.getUserSessionsByUserId);
    const deleteUserSessions = useUserStore((s) => s.deleteUserSessions);
    const setSelectedUser = useUserStore((s) => s.setSelectedUser);
    const clearError = useUserStore((s) => s.clearError);
    const reset = useUserStore((s) => s.reset);


    // --- HANDLERS ---

    const handleGetUsers = useCallback(
        (filters) => getUsers(filters),
        [getUsers],
    );

    const handleGetUserById = useCallback(
        (id) => getUserById(id),
        [getUserById],
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
        handleGetUsers,
        handleGetUserById,
        handleCreateUser,
        handleUpdateUser,
        handleUpdateUsers,
        handleUpdateCredential,
        handleUpdateSetting,
        handleDeleteSessions,

        // Direct
        getUsersByDepartmentId,
        getUserByUniversityId,
        getUserByEmail,
        getUserCredentialByUserId,
        getUserSettingByUserId,
        getUserSessionsByUserId,
        setSelectedUser,
        clearError,
        reset,
    };
};
