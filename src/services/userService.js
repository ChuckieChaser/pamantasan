// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';
import { departmentService } from './departmentService';
import { DEFAULT_DEPARTMENTS } from '../constants';

// --- HELPERS ---
function formatLiveUser(rawUser) {
    if (!rawUser) {
        return null;
    }

    const firstName = rawUser.firstName ?? '';
    const lastName = rawUser.lastName ?? '';
    const middleName = rawUser.middleName ?? null;

    return {
        id: rawUser.id,
        university_id: rawUser.universityId,
        universityId: rawUser.universityId,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        name: `${firstName} ${lastName}`.trim(),
        email: rawUser.email,
        role: rawUser.role ?? 'MEMBER',
        status: rawUser.status ?? 'VERIFIED',
        department_id: rawUser.department?.id ?? null,
        department: rawUser.department?.name ?? 'College of Computer Studies',
        department_code: rawUser.department?.code ?? 'CCS',
        avatar_path: rawUser.avatarPath ?? null,
    };
}

// --- SERVICE IMPLEMENTATION ---
const userService = {
    fetchUsers: async () => {
        try {
            const data = await dataConnectService.executeQuery('ListUsers');
            const users = data?.users ?? [];
            return users.map(formatLiveUser);
        } catch (error) {
            console.error('Failed to fetch users from Firebase Data Connect:', error);
            return [];
        }
    },

    fetchUserByUniversityId: async (universityId) => {
        try {
            const data = await dataConnectService.executeQuery('GetUserByUniversityId', { universityId });
            const users = data?.users ?? [];
            return users.length > 0 ? formatLiveUser(users[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch user with university ID "${universityId}":`, error);
            return null;
        }
    },

    fetchUserByEmail: async (email) => {
        try {
            const data = await dataConnectService.executeQuery('GetUserByEmail', { email });
            const users = data?.users ?? [];
            return users.length > 0 ? formatLiveUser(users[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch user with email "${email}":`, error);
            return null;
        }
    },

    createUser: async (payload) => {
        let targetDepartmentId = payload.departmentId ?? payload.department_id;

        // Auto-resolve live PostgreSQL Department UUID
        try {
            const liveDepts = await departmentService.fetchDepartments();
            let matchingDept = liveDepts.find((d) => d.id === targetDepartmentId);

            if (!matchingDept) {
                const fallbackDept = DEFAULT_DEPARTMENTS.find(
                    (d) => d.id === targetDepartmentId || d.code === targetDepartmentId || d.name === targetDepartmentId
                );

                if (fallbackDept) {
                    matchingDept = liveDepts.find((d) => d.code === fallbackDept.code);
                    if (!matchingDept) {
                        await departmentService.createDepartment({
                            name: fallbackDept.name,
                            code: fallbackDept.code,
                        });
                        const refreshed = await departmentService.fetchDepartmentByCode(fallbackDept.code);
                        if (refreshed?.id) {
                            targetDepartmentId = refreshed.id;
                        }
                    } else {
                        targetDepartmentId = matchingDept.id;
                    }
                } else if (liveDepts.length > 0) {
                    targetDepartmentId = liveDepts[0].id;
                }
            }
        } catch (deptError) {
            console.warn('Could not auto-resolve department ID:', deptError);
        }

        const data = await dataConnectService.executeMutation('CreateUser', {
            universityId: payload.universityId ?? payload.university_id,
            email: payload.email,
            role: payload.role,
            status: payload.status ?? 'VERIFIED',
            firstName: payload.firstName ?? payload.first_name,
            middleName: payload.middleName ?? payload.middle_name ?? null,
            lastName: payload.lastName ?? payload.last_name,
            avatarPath: payload.avatarPath ?? payload.avatar_path ?? null,
            departmentId: targetDepartmentId,
        });
        return formatLiveUser(data?.user_insert);
    },

    updateUser: async (id, payload) => {
        try {
            const data = await dataConnectService.executeMutation('UpdateUser', {
                id,
                role: payload.role ?? undefined,
                status: payload.status ?? undefined,
                firstName: payload.firstName ?? payload.first_name ?? undefined,
                middleName: payload.middleName ?? payload.middle_name ?? undefined,
                lastName: payload.lastName ?? payload.last_name ?? undefined,
                avatarPath: payload.avatarPath ?? payload.avatar_path ?? undefined,
            });
            return formatLiveUser(data?.user_update);
        } catch (error) {
            console.error(`Failed to update user "${id}" via Data Connect:`, error);
            return {
                id,
                ...payload,
                avatar_path: payload.avatarPath ?? payload.avatar_path ?? null,
            };
        }
    },

    deleteUser: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteUser', { id });
        return Boolean(data?.user_delete);
    },
};

export {
    userService,
    formatLiveUser,
};

export default userService;
