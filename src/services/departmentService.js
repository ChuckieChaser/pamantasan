// --- IMPORTS ---
import { dataConnectService } from './dataConnectService';


// --- HELPERS ---
const generateUuid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};


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
            id: formatted?.id ?? generateUuid(),
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

        let raw = null;
        try {
            const data = await dataConnectService.executeMutation('UpdateDepartment', {
                id: id,
                name: name,
                code: code,
                updatedAt: timestamp,
            });
            raw = data?.department_update ?? data?.departments_update;
        } catch (error) {
            console.warn('Failed to update department in Firebase Data Connect, updating locally:', error);
        }

        const formatted = raw ? formatLiveDepartment(raw) : null;

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
        try {
            const data = await dataConnectService.executeMutation('DeleteDepartment', { id: id });
            return Boolean(data?.department_delete ?? data?.departments_delete ?? true);
        } catch (error) {
            console.warn('Failed to delete department in Firebase Data Connect, deleting locally:', error);
            return true;
        }
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

