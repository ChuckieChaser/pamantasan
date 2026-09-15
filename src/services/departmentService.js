// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';


// --- SERVICES ---
const departmentService = {
    // CORE
    fetchDepartments: async () => {
        try {
            const data = await dataConnectService.executeQuery('FetchDepartments');
            const departments = data?.departments ?? [];

            return departments.map(formatLiveDepartment);
        } catch (error) {
            console.error('Failed to fetch departments from Firebase Data Connect:', error);
            return [];
        }
    },

    fetchDepartmentById: async (id) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDepartmentById', { id: id });
            const departments = data?.departments ?? [];

            return departments.length > 0 ? formatLiveDepartment(departments[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch department with ID "${id}":`, error);
            return null;
        }
    },

    fetchDepartmentByCode: async (code) => {
        try {
            const data = await dataConnectService.executeQuery('FetchDepartmentByCode', { code: code });
            const departments = data?.departments ?? [];

            return departments.length > 0 ? formatLiveDepartment(departments[0]) : null;
        } catch (error) {
            console.error(`Failed to fetch department with code "${code}":`, error);
            return null;
        }
    },

    insertDepartment: async (payload) => {
        const data = await dataConnectService.executeMutation('InsertDepartment', {
            name: payload.name,
            code: payload.code,
            createdAt: payload.createdAt,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDepartment(data?.department_insert ?? data?.departments_insert);
    },

    updateDepartment: async (id, payload) => {
        const data = await dataConnectService.executeMutation('UpdateDepartment', {
            id: id,
            name: payload.name,
            code: payload.code,
            updatedAt: payload.updatedAt,
        });

        return formatLiveDepartment(data?.department_update ?? data?.departments_update);
    },

    deleteDepartment: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteDepartment', { id: id });
        return Boolean(data?.department_delete ?? data?.departments_delete);
    },
};


// --- HELPERS ---
function formatLiveDepartment(rawDepartment) {
    if (!rawDepartment) {
        return null;
    }

    return {
        id: rawDepartment.id,
        name: rawDepartment.name,
        code: rawDepartment.code,
        createdAt: rawDepartment.createdAt,
        updatedAt: rawDepartment.updatedAt,
    };
}


// --- EXPORTS ---
export { departmentService };

