// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';

// --- SERVICE IMPLEMENTATION ---
const departmentService = {
    fetchDepartments: async () => {
        try {
            const data = await dataConnectService.executeQuery('ListDepartments');
            const departments = data?.departments ?? [];
            return departments.map((dept) => ({
                id: dept.id,
                name: dept.name,
                code: dept.code,
            }));
        } catch (error) {
            console.error('Failed to fetch departments from Firebase Data Connect:', error);
            return [];
        }
    },

    fetchDepartmentById: async (id) => {
        try {
            const data = await dataConnectService.executeQuery('GetDepartmentById', { id });
            return data?.department ?? null;
        } catch (error) {
            console.error(`Failed to fetch department with id "${id}":`, error);
            return null;
        }
    },

    fetchDepartmentByCode: async (code) => {
        try {
            const data = await dataConnectService.executeQuery('GetDepartmentByCode', { code });
            const departments = data?.departments ?? [];
            return departments[0] ?? null;
        } catch (error) {
            console.error(`Failed to fetch department with code "${code}":`, error);
            return null;
        }
    },

    createDepartment: async (payload) => {
        const data = await dataConnectService.executeMutation('CreateDepartment', {
            name: payload.name,
            code: payload.code,
        });
        return data?.department_insert ?? null;
    },

    updateDepartment: async (id, payload) => {
        const data = await dataConnectService.executeMutation('UpdateDepartment', {
            id,
            name: payload.name,
            code: payload.code,
        });
        return data?.department_update ?? null;
    },

    deleteDepartment: async (id) => {
        const data = await dataConnectService.executeMutation('DeleteDepartment', { id });
        return Boolean(data?.department_delete);
    },
};

export {
    departmentService,
};

export default departmentService;
