// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';
import { constants } from '../constants';


// --- CONFIGURATIONS ---
const DEFAULT_AVATAR_STORAGE_PATH = 'avatars/defaultAvatar.png';


// --- SERVICES ---
const userService = {
    // USERS
    fetchUsers: async () => {
        try {
            const data = await dataConnectService.executeQuery('FetchUsers');
            const users = data?.users ?? [];

            return users.map(formatLiveUser);
        } catch (error) {
            console.error('Failed to fetch users from Firebase Data Connect:', error);
            return [];
        }
    },

    fetchUserById: async (id) => {
        try {
            const data = await dataConnectService.executeQuery('FetchUserById', { id: id });
            const users = data?.users ?? [];

            return users.length > 0 ? formatLiveUser(users[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch user with ID "${id}":`, error);
            return null;
        }
    },

    fetchUserByUniversityId: async (universityId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchUserByUniversityId', { universityId: universityId });
            const users = data?.users ?? [];

            return users.length > 0 ? formatLiveUser(users[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch user with university ID "${universityId}":`, error);
            return null;
        }
    },

    fetchUserByEmail: async (email) => {
        try {
            const data = await dataConnectService.executeQuery('FetchUserByEmail', { email: email });
            const users = data?.users ?? [];

            return users.length > 0 ? formatLiveUser(users[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch user with email "${email}":`, error);
            return null;
        }
    },

    insertUser: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertUser', {
            universityId: payload.universityId,
            departmentId: payload.departmentId,
            role: payload.role,
            email: payload.email,
            avatarPath: payload.avatarPath ?? DEFAULT_AVATAR_STORAGE_PATH,
            firstName: payload.firstName,
            middleName: payload.middleName ?? null,
            lastName: payload.lastName,
            status: payload.status ?? constants.USERS_STATUS.PENDING_PASSWORD,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveUser(data?.user_insert ?? data?.users_insert);
    },

    updateUser: async (id, payload) => {
        const data = await dataConnectService.executeMutation('UpdateUser', {
            id: id,
            departmentId: payload.departmentId,
            role: payload.role,
            email: payload.email,
            avatarPath: payload.avatarPath,
            firstName: payload.firstName,
            middleName: payload.middleName,
            lastName: payload.lastName,
            status: payload.status,
            updatedAt: payload.updatedAt,
        });

        return formatLiveUser(data?.user_update ?? data?.users_update);
    },

    deleteUser: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteUser', { id: id });
        return Boolean(data?.user_delete ?? data?.users_delete);
    },

    // CREDENTIALS
    fetchUserCredentialsByUserId: async (userId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchUserCredentialsByUserId', { userId: userId });
            const userCredentials = data?.userCredentials ?? [];

            return userCredentials.length > 0 ? formatLiveUserCredential(userCredentials[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch credentials for user "${userId}":`, error);
            return null;
        }
    },

    insertUserCredential: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertUserCredential', {
            userId: payload.userId,
            passwordHash: payload.passwordHash ?? payload.universityId,
            googleId: payload.googleId ?? null,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveUserCredential(data?.userCredential_insert ?? data?.userCredentials_insert);
    },

    updateUserCredential: async (userId, payload) => {
        const data = await dataConnectService.executeMutation('UpdateUserCredential', {
            userId: userId,
            passwordHash: payload.passwordHash,
            googleId: payload.googleId,
            updatedAt: payload.updatedAt,
        });

        return formatLiveUserCredential(data?.userCredential_update ?? data?.userCredentials_update);
    },

    deleteUserCredential: async (userId) => {
        const data = await dataConnectService.executeMutation('DeleteUserCredential', { userId: userId });
        return Boolean(data?.userCredential_delete ?? data?.userCredentials_delete);
    },

    // SETTINGS
    fetchUserSettingsByUserId: async (userId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchUserSettingsByUserId', { userId: userId });
            const userSettings = data?.userSettings ?? [];

            return userSettings.length > 0 ? formatLiveUserSetting(userSettings[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch settings for user "${userId}":`, error);
            return null;
        }
    },

    insertUserSetting: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertUserSetting', {
            userId: payload.userId,
            theme: payload.theme ?? constants.USER_SETTINGS_THEME.SYSTEM,
            notification: payload.notification ?? constants.USER_SETTINGS_NOTIFICATION.ALL,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveUserSetting(data?.userSetting_insert ?? data?.userSettings_insert);
    },

    updateUserSetting: async (userId, payload) => {
        const data = await dataConnectService.executeMutation('UpdateUserSetting', {
            userId: userId,
            theme: payload.theme,
            notification: payload.notification,
            updatedAt: payload.updatedAt,
        });

        return formatLiveUserSetting(data?.userSetting_update ?? data?.userSettings_update);
    },

    deleteUserSetting: async (userId) => {
        const data = await dataConnectService.executeMutation('DeleteUserSetting', { userId: userId });
        return Boolean(data?.userSetting_delete ?? data?.userSettings_delete);
    },

    // SESSIONS
    fetchUserSessionsByUserId: async (userId) => {
        try {
            const data = await dataConnectService.executeQuery('FetchUserSessionsByUserId', { userId: userId });
            const userSessions = data?.userSessions ?? [];

            return userSessions.map(formatLiveUserSession);
        } catch (error) {
            console.error(`Failed to fetch sessions for user "${userId}":`, error);
            return [];
        }
    },

    insertUserSession: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertUserSession', {
            userId: payload.userId,
            tokenHash: payload.tokenHash,
            ipAddress: payload.ipAddress,
            userAgent: payload.userAgent,
            createdAt: payload.createdAt,
            expiredAt: payload.expiredAt,
        });

        return formatLiveUserSession(data?.userSession_insert ?? data?.userSessions_insert);
    },

    deleteUserSession: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteUserSession', { id: id });
        return Boolean(data?.userSession_delete ?? data?.userSessions_delete);
    },
};


// --- HELPERS ---
function formatLiveUser(rawUser) {
    if (!rawUser) {
        return null;
    }

    const deptId = typeof rawUser.department === 'object'
        ? rawUser.department?.id
        : (rawUser.departmentId ?? rawUser.department_id ?? null);

    const deptName = typeof rawUser.department === 'object'
        ? (rawUser.department?.name ?? 'Central Administration')
        : (typeof rawUser.department === 'string' ? rawUser.department : 'Central Administration');

    const deptCode = typeof rawUser.department === 'object'
        ? rawUser.department?.code
        : null;

    return {
        id: rawUser.id,
        universityId: rawUser.universityId,
        university_id: rawUser.universityId,
        department: deptName,
        department_name: deptName,
        department_code: deptCode,
        department_id: deptId,
        departmentId: deptId,
        departmentObj: typeof rawUser.department === 'object' ? rawUser.department : null,
        role: rawUser.role,
        email: rawUser.email,
        avatarPath: rawUser.avatarPath,
        avatar_path: rawUser.avatarPath,
        firstName: rawUser.firstName,
        first_name: rawUser.firstName,
        middleName: rawUser.middleName,
        middle_name: rawUser.middleName,
        lastName: rawUser.lastName,
        last_name: rawUser.lastName,
        status: rawUser.status,
        createdAt: rawUser.createdAt,
        created_at: rawUser.createdAt,
        updatedAt: rawUser.updatedAt,
        updated_at: rawUser.updatedAt,
    };
}

function formatLiveUserCredential(rawCredential) {
    if (!rawCredential) {
        return null;
    }

    return {
        user: rawCredential.user,
        passwordHash: rawCredential.passwordHash,
        googleId: rawCredential.googleId,
        createdAt: rawCredential.createdAt,
        updatedAt: rawCredential.updatedAt,
    };
}

function formatLiveUserSetting(rawSetting) {
    if (!rawSetting) {
        return null;
    }

    return {
        user: rawSetting.user,
        theme: rawSetting.theme,
        notification: rawSetting.notification,
        createdAt: rawSetting.createdAt,
        updatedAt: rawSetting.updatedAt,
    };
}

function formatLiveUserSession(rawSession) {
    if (!rawSession) {
        return null;
    }

    return {
        id: rawSession.id,
        user: rawSession.user,
        tokenHash: rawSession.tokenHash,
        ipAddress: rawSession.ipAddress,
        userAgent: rawSession.userAgent,
        createdAt: rawSession.createdAt,
        expiredAt: rawSession.expiredAt,
    };
}


// --- EXPORTS ---
export { userService };
