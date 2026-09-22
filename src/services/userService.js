// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';
import { constants } from '../constants';


// --- CONFIGURATIONS ---
const DEFAULT_AVATAR_STORAGE_PATH = 'avatars/placeholder.png';


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
        const timestamp = payload.createdAt ?? new Date().toISOString();
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
            createdAt: timestamp,
            updatedAt: payload.updatedAt ?? timestamp,
        });

        const createdUserKey = data?.user_insert ?? data?.users_insert;
        const newUserId = createdUserKey?.id;

        const createdUser = {
            id: newUserId,
            universityId: payload.universityId,
            departmentId: payload.departmentId,
            role: payload.role,
            email: payload.email,
            avatarPath: payload.avatarPath ?? DEFAULT_AVATAR_STORAGE_PATH,
            firstName: payload.firstName,
            middleName: payload.middleName ?? null,
            lastName: payload.lastName,
            status: payload.status ?? constants.USERS_STATUS.PENDING_PASSWORD,
            createdAt: timestamp,
            updatedAt: payload.updatedAt ?? timestamp,
        };

        if (newUserId) {
            // Provision default UserCredential: password = university id, googleId = null
            try {
                const initialPassword = payload.password || payload.universityId;
                const passwordHash = await hashPassword(initialPassword);
                await userService.insertUserCredential({
                    userId: newUserId,
                    passwordHash: passwordHash,
                    googleId: null,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                });
            } catch (credError) {
                console.warn(`Failed to provision default credentials for user "${newUserId}":`, credError);
            }

            // Provision default UserSetting: theme = SYSTEM, notification = ALL
            try {
                await userService.insertUserSetting({
                    userId: newUserId,
                    theme: constants.USER_SETTINGS_THEME.SYSTEM,
                    notification: constants.USER_SETTINGS_NOTIFICATION.ALL,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                });
            } catch (settingError) {
                console.warn(`Failed to provision default settings for user "${newUserId}":`, settingError);
            }
        }

        return createdUser;
    },

    updateUser: async (id, payload) => {
        const timestamp = new Date().toISOString();

        // Always fetch existing user to preserve all fields including universityId, department, role, email, avatarPath, etc.
        let existing = null;
        try {
            existing = await userService.fetchUserById(id);
        } catch (fetchError) {
            console.warn(`Failed to fetch existing user "${id}" during updateUser merge:`, fetchError);
        }

        const mergedPayload = {
            ...(existing || {}),
            ...payload,
        };

        const payloadWithUpdate = {
            ...mergedPayload,
            updatedAt: payload.updatedAt ?? timestamp,
        };

        const data = await dataConnectService.executeMutation('UpdateUser', {
            id: id,
            departmentId: payloadWithUpdate.departmentId ?? null,
            role: payloadWithUpdate.role ?? null,
            email: payloadWithUpdate.email ?? null,
            avatarPath: payloadWithUpdate.avatarPath ?? null,
            firstName: payloadWithUpdate.firstName ?? null,
            middleName: payloadWithUpdate.middleName ?? null,
            lastName: payloadWithUpdate.lastName ?? null,
            status: payloadWithUpdate.status ?? null,
            updatedAt: payloadWithUpdate.updatedAt,
        });

        const rawResult = data?.user_update ?? data?.users_update;
        const formatted = rawResult && (rawResult.firstName || rawResult.email || rawResult.universityId)
            ? formatLiveUser(rawResult)
            : null;

        const cleanPayload = Object.fromEntries(
            Object.entries(payloadWithUpdate).filter(([, v]) => v !== undefined)
        );
        const cleanFormatted = formatted
            ? Object.fromEntries(Object.entries(formatted).filter(([, v]) => v !== undefined))
            : {};

        return {
            ...(existing || {}),
            ...cleanPayload,
            ...cleanFormatted,
            id: id,
        };
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
        const rawPassword = payload.passwordHash ?? payload.universityId ?? '';
        const passwordHash = await hashPassword(rawPassword);

        const data = await dataConnectService.executeMutation('InsertUserCredential', {
            userId: payload.userId,
            passwordHash: passwordHash,
            googleId: payload.googleId ?? null,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveUserCredential(data?.userCredential_insert ?? data?.userCredentials_insert);
    },

    updateUserCredential: async (userId, payload) => {
        let passwordHash = payload.passwordHash;
        if (passwordHash) {
            passwordHash = await hashPassword(passwordHash);
        }

        const data = await dataConnectService.executeMutation('UpdateUserCredential', {
            userId: userId,
            passwordHash: passwordHash,
            googleId: payload.googleId,
            updatedAt: payload.updatedAt,
        });

        return formatLiveUserCredential(data?.userCredential_update ?? data?.userCredentials_update);
    },

    deleteUserCredential: async (userId) => {
        const data = await dataConnectService.executeMutation('DeleteUserCredential', { userId: userId });
        return Boolean(data?.userCredential_delete ?? data?.userCredentials_delete);
    },

    upsertUserCredential: async (userId, payload) => {
        const existing = await userService.fetchUserCredentialsByUserId(userId);
        if (existing) {
            return await userService.updateUserCredential(userId, payload);
        } else {
            const timestamp = new Date().toISOString();
            return await userService.insertUserCredential({
                userId: userId,
                passwordHash: payload.passwordHash || '',
                googleId: payload.googleId ?? null,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        }
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
            avatar: payload.avatar ?? constants.USER_SETTINGS_AVATAR.SYSTEM,
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
            avatar: payload.avatar,
            updatedAt: payload.updatedAt,
        });

        return formatLiveUserSetting(data?.userSetting_update ?? data?.userSettings_update);
    },

    deleteUserSetting: async (userId) => {
        const data = await dataConnectService.executeMutation('DeleteUserSetting', { userId: userId });
        return Boolean(data?.userSetting_delete ?? data?.userSettings_delete);
    },

    upsertUserSetting: async (userId, payload) => {
        try {
            const existing = await userService.fetchUserSettingsByUserId(userId);
            if (existing) {
                return await userService.updateUserSetting(userId, payload);
            } else {
                return await userService.insertUserSetting({
                    userId: userId,
                    theme: payload.theme ?? constants.USER_SETTINGS_THEME.SYSTEM,
                    notification: payload.notification ?? constants.USER_SETTINGS_NOTIFICATION.ALL,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.error(`Failed to upsert settings for user "${userId}":`, error);
            throw error;
        }
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

        const raw = data?.userSession_insert ?? data?.userSessions_insert;
        const formatted = formatLiveUserSession(raw);
        if (formatted && formatted.id) {
            return formatted;
        }

        return {
            id: raw?.id ?? raw?.key?.id ?? payload.tokenHash,
            tokenHash: payload.tokenHash,
            ...payload,
        };
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
        : (rawUser.departmentId ?? null);

    const deptName = typeof rawUser.department === 'object'
        ? (rawUser.department?.name ?? 'Central Administration')
        : (typeof rawUser.department === 'string' ? rawUser.department : 'Central Administration');

    const deptCode = typeof rawUser.department === 'object'
        ? rawUser.department?.code
        : null;

    return {
        id: rawUser.id,
        universityId: rawUser.universityId,
        departmentId: deptId,
        department: deptName,
        departmentCode: deptCode,
        role: rawUser.role,
        email: rawUser.email,
        avatarPath: rawUser.avatarPath ?? null,
        firstName: rawUser.firstName,
        middleName: rawUser.middleName ?? null,
        lastName: rawUser.lastName,
        status: rawUser.status,
        createdAt: rawUser.createdAt,
        updatedAt: rawUser.updatedAt,
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
        avatar: rawSetting.avatar ?? constants.USER_SETTINGS_AVATAR.SYSTEM,
        createdAt: rawSetting.createdAt,
        updatedAt: rawSetting.updatedAt,
    };
}

function formatLiveUserSession(rawSession) {
    if (!rawSession) {
        return null;
    }

    return {
        id: rawSession.id ?? rawSession.key?.id ?? rawSession.tokenHash ?? null,
        user: rawSession.user,
        tokenHash: rawSession.tokenHash,
        ipAddress: rawSession.ipAddress,
        userAgent: rawSession.userAgent,
        createdAt: rawSession.createdAt,
        expiredAt: rawSession.expiredAt,
    };
}


async function hashPassword(plainTextPassword) {
    if (!plainTextPassword) return '';
    // If it's already a 64-character lowercase hex string, it's already a SHA-256 hash
    if (/^[0-9a-f]{64}$/i.test(plainTextPassword)) {
        return plainTextPassword.toLowerCase();
    }
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(plainTextPassword);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('Crypto.subtle hashing failed, fallback used:', error);
        }
    }
    let hash = 0;
    for (let i = 0; i < plainTextPassword.length; i++) {
        const char = plainTextPassword.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(16).padStart(16, '0')}`;
}


// --- EXPORTS ---
export { userService, hashPassword };

