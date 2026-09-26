// --- IMPORTS ---
import { executeDataQuery, executeDataMutation } from '../../services/dataConnectService';
import { CreateUserSchema, UpdateUserSchema, UpdateUsersSchema, UpdateUserCredentialSchema, UpdateUserSettingSchema, CreateUserSessionSchema, UpdateUserSessionSchema, DeleteUserSessionsSchema } from './userSchema';


// --- USER SERVICES ---
export const getUsers = async ({
    search = '',
    roles,
    statuses,
    orderBy = [{ lastName: 'ASC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    const data = await executeDataQuery('GetUsers', {
        search,
        roles,
        statuses,
        orderBy,
        limit,
        offset,
    });

    return data?.users ?? [];
};

export const getUsersByDepartmentId = async ({
    search = '',
    departmentId,
    roles,
    statuses,
    orderBy = [{ lastName: 'ASC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    if (!departmentId) {
        throw new Error('Department ID is required to fetch department users.');
    }

    const data = await executeDataQuery('GetUsersByDepartmentId', {
        search,
        departmentId,
        roles,
        statuses,
        orderBy,
        limit,
        offset,
    });

    return data?.users ?? [];
};

export const getUserById = async (id) => {
    if (!id) return null;

    const data = await executeDataQuery('GetUserById', { id });
    const users = data?.users ?? [];

    return users[0] ?? null;
};

export const getUserByUniversityId = async (universityId) => {
    if (!universityId) return null;

    const data = await executeDataQuery('GetUserByUniversityId', { universityId });
    const users = data?.users ?? [];

    return users[0] ?? null;
};

export const getUserByEmail = async (email) => {
    if (!email) return null;

    const data = await executeDataQuery('GetUserByEmail', { email });
    const users = data?.users ?? [];

    return users[0] ?? null;
};

export const createUser = async (payload) => {
    const validated = CreateUserSchema.parse(payload);

    const data = await executeDataMutation('CreateUser', {
        id: validated.id,
        universityId: validated.universityId,
        departmentId: validated.departmentId,
        role: validated.role,
        email: validated.email,
        avatar: validated.avatar ?? null,
        givenName: validated.givenName,
        lastName: validated.lastName,
        passwordHash: validated.passwordHash,
        googleId: validated.googleId ?? null,
    });

    return data?.user_insert ?? null;
};

export const updateUser = async (id, payload) => {
    if (!id) {
        throw new Error('User ID is required for update.');
    }

    const validated = UpdateUserSchema.parse({ ...payload, id });

    const data = await executeDataMutation('UpdateUser', {
        id: validated.id,
        departmentId: validated.departmentId,
        role: validated.role,
        email: validated.email,
        avatar: validated.avatar,
        givenName: validated.givenName,
        lastName: validated.lastName,
        status: validated.status,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.user_update ?? null;
};

export const updateUsers = async (ids, payload = {}) => {
    const validated = UpdateUsersSchema.parse({ ...payload, ids });

    const data = await executeDataMutation('UpdateUsers', {
        ids: validated.ids,
        departmentId: validated.departmentId,
        role: validated.role,
        status: validated.status,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.user_updateMany ?? null;
};


// --- USER CREDENTIAL SERVICES ---
export const getUserCredentialByUserId = async (userId) => {
    if (!userId) return null;

    const data = await executeDataQuery('GetUserCredentialByUserId', { userId });
    const credentials = data?.userCredentials ?? [];

    return credentials[0] ?? null;
};

export const updateUserCredential = async (userId, payload) => {
    if (!userId) {
        throw new Error('User ID is required to update credentials.');
    }

    const validated = UpdateUserCredentialSchema.parse({ ...payload, userId });

    const data = await executeDataMutation('UpdateUserCredential', {
        userId: validated.userId,
        passwordHash: validated.passwordHash,
        googleId: validated.googleId,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.userCredential_update ?? null;
};


// --- USER SETTING SERVICES ---
export const getUserSettingByUserId = async (userId) => {
    if (!userId) return null;

    const data = await executeDataQuery('GetUserSettingByUserId', { userId });
    const settings = data?.userSettings ?? [];

    return settings[0] ?? null;
};

export const updateUserSetting = async (userId, payload) => {
    if (!userId) {
        throw new Error('User ID is required to update settings.');
    }

    const validated = UpdateUserSettingSchema.parse({ ...payload, userId });

    const data = await executeDataMutation('UpdateUserSetting', {
        userId: validated.userId,
        theme: validated.theme,
        notification: validated.notification,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.userSetting_update ?? null;
};


// --- USER SESSION SERVICES ---
export const getUserSessionsByUserId = async (userId) => {
    if (!userId) return [];

    const data = await executeDataQuery('GetUserSessionsByUserId', { userId });

    return data?.userSessions ?? [];
};

export const createUserSession = async (payload) => {
    const validated = CreateUserSessionSchema.parse(payload);

    const data = await executeDataMutation('CreateUserSession', {
        userId: validated.userId,
        tokenHash: validated.tokenHash,
        ipAddress: validated.ipAddress ?? null,
        userAgent: validated.userAgent ?? null,
        expiredAt: validated.expiredAt ?? null,
    });

    return data?.userSession_insert ?? null;
};

export const updateUserSession = async (id, expiredAt) => {
    if (!id) {
        throw new Error('Session ID is required to update session.');
    }

    const validated = UpdateUserSessionSchema.parse({ id, expiredAt });

    const data = await executeDataMutation('UpdateUserSession', {
        id: validated.id,
        expiredAt: validated.expiredAt,
    });

    return data?.userSession_update ?? null;
};

export const deleteUserSessions = async (ids) => {
    const validated = DeleteUserSessionsSchema.parse({ ids });

    const data = await executeDataMutation('DeleteUserSessions', {
        ids: validated.ids,
    });

    return data?.userSession_deleteMany ?? null;
};
