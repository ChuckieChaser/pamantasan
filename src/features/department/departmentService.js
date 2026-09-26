// --- IMPORTS ---
import { executeDataQuery, executeDataMutation } from '../../services/dataConnectService';
import { CreateDepartmentSchema, UpdateDepartmentSchema, DeleteDepartmentsSchema } from './departmentSchema';


// --- DEPARTMENT SERVICES ---
export const getDepartments = async ({
    search = '',
    orderBy = [{ name: 'ASC' }],
    limit = 100,
    offset = 0,
} = {}) => {
    const data = await executeDataQuery('GetDepartments', {
        search,
        orderBy,
        limit,
        offset,
    });

    return data?.departments ?? [];
};

export const getDepartmentById = async (id) => {
    if (!id) return null;

    const data = await executeDataQuery('GetDepartmentById', { id });
    const departments = data?.departments ?? [];

    return departments[0] ?? null;
};

export const getDepartmentByCode = async (code) => {
    if (!code) return null;

    const data = await executeDataQuery('GetDepartmentByCode', { code });
    const departments = data?.departments ?? [];

    return departments[0] ?? null;
};

export const createDepartment = async (payload) => {
    const validated = CreateDepartmentSchema.parse(payload);

    const data = await executeDataMutation('CreateDepartment', {
        logo: validated.logo ?? null,
        name: validated.name,
        code: validated.code,
    });

    return data?.department_insert ?? null;
};

export const updateDepartment = async (id, payload) => {
    if (!id) {
        throw new Error('Department ID is required for update.');
    }

    const validated = UpdateDepartmentSchema.parse({ ...payload, id });

    const data = await executeDataMutation('UpdateDepartment', {
        id: validated.id,
        logo: validated.logo,
        name: validated.name,
        code: validated.code,
        updatedAt: validated.updatedAt ?? new Date().toISOString(),
    });

    return data?.department_update ?? null;
};

export const deleteDepartments = async (ids) => {
    const validated = DeleteDepartmentsSchema.parse({ ids });

    const data = await executeDataMutation('DeleteDepartments', {
        ids: validated.ids,
    });

    return data?.department_deleteMany ?? null;
};
