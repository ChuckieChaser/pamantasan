// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';


// --- SERVICES ---
const departmentService = {
    // CORE
    fetchDepartments: async () => {
        try {
            const data = await dataConnectService.executeQuery('FetchDepartments');
            const departments = data?.departments ?? [];

            return departments.map(formatLiveDepartment).filter(Boolean);
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
        const timestamp = payload.createdAt || new Date().toISOString();
        const updatedTimestamp = payload.updatedAt || timestamp;
        const data = await dataConnectService.executeMutation('InsertDepartment', {
            name: payload.name,
            code: payload.code,
            createdAt: timestamp,
            updatedAt: updatedTimestamp,
        });

        const raw = data?.department_insert ?? data?.departments_insert;
        const formatted = formatLiveDepartment(raw);

        return {
            id: formatted?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `dept-${Date.now()}`),
            name: payload.name,
            code: payload.code,
            createdAt: timestamp,
            updatedAt: updatedTimestamp,
        };
    },

    updateDepartment: async (id, payload) => {
        const timestamp = payload.updatedAt || new Date().toISOString();
        let existing = null;
        try {
            existing = await departmentService.fetchDepartmentById(id);
        } catch (e) {
            console.warn('fetchDepartmentById failed during updateDepartment merge:', e);
        }

        const name = payload.name ?? existing?.name;
        const code = payload.code ?? existing?.code;

        const data = await dataConnectService.executeMutation('UpdateDepartment', {
            id: id,
            name: name,
            code: code,
            updatedAt: timestamp,
        });

        const raw = data?.department_update ?? data?.departments_update;
        const formatted = formatLiveDepartment(raw);

        return {
            ...(existing || {}),
            id: formatted?.id ?? id,
            name: name,
            code: code,
            createdAt: existing?.createdAt,
            updatedAt: timestamp,
        };
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
        id: rawDepartment.id ?? rawDepartment.key?.id,
        name: rawDepartment.name,
        code: rawDepartment.code,
        createdAt: rawDepartment.createdAt,
        updatedAt: rawDepartment.updatedAt,
    };
}


// --- EXPORTS ---
export { departmentService };

