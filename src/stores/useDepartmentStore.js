// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { departmentService, systemEventService } from '../services';
import { constants } from '../constants';


// --- STORE ---
const useDepartmentStore = create((set, get) => ({
    // STATES
    departments: [],
    selectedDepartment: null,
    isLoading: false,
    error: null,

    // CORE
    fetchDepartments: async () => {
        set({ isLoading: true, error: null });

        try {
            const departments = await departmentService.fetchDepartments();

            set((state) => {
                if (departments && departments.length > 0) {
                    const serverDeptMap = new Map();
                    departments.forEach((dept) => {
                        if (dept?.id) serverDeptMap.set(dept.id, dept);
                        if (dept?.code) serverDeptMap.set(`code:${dept.code.toUpperCase()}`, dept);
                    });

                    // Retain any locally added departments that may not yet be in the server response
                    const preservedLocal = state.departments.filter((localDept) => {
                        if (!localDept) return false;
                        const byId = localDept.id && serverDeptMap.has(localDept.id);
                        const byCode = localDept.code && serverDeptMap.has(`code:${localDept.code.toUpperCase()}`);
                        return !byId && !byCode;
                    });

                    return {
                        departments: [...departments, ...preservedLocal],
                        isLoading: false,
                        error: null,
                    };
                }

                // If server returned 0 items but we already have local items, do not wipe them
                if (state.departments.length > 0) {
                    return {
                        isLoading: false,
                        error: null,
                    };
                }

                return {
                    departments: [],
                    isLoading: false,
                    error: null,
                };
            });

            return departments;
        } catch (error) {
            const message = error?.message ?? 'Failed to fetch departments.';
            set({ isLoading: false, error: message });

            return [];
        }
    },

    fetchDepartmentById: async (id) => {
        set({ isLoading: true, error: null });

        try {
            let department = get().departments.find((item) => item?.id === id);

            if (!department) {
                department = await departmentService.fetchDepartmentById(id);
            }

            set({ selectedDepartment: department, isLoading: false, error: null });

            return department;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch department with ID "${id}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    fetchDepartmentByCode: async (code) => {
        set({ isLoading: true, error: null });

        try {
            let department = get().departments.find((item) => item?.code?.toUpperCase() === code?.toUpperCase());

            if (!department) {
                department = await departmentService.fetchDepartmentByCode(code);
            }

            set({ selectedDepartment: department, isLoading: false, error: null });
            return department;
        } catch (error) {
            const message = error?.message ?? `Failed to fetch department with code "${code}".`;
            set({ isLoading: false, error: message });

            return null;
        }
    },

    insertDepartment: async (payload) => {
        set({ isLoading: true, error: null });

        try {
            const timestamp = new Date().toISOString();
            const payloadWithDates = {
                createdAt: timestamp,
                updatedAt: timestamp,
                ...payload,
            };
            const validatedPayload = mutationSchema.InsertDepartmentSchema.parse(payloadWithDates);
            const result = await departmentService.insertDepartment(validatedPayload);

            const newDepartment = {
                id: result?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `dept-${Date.now()}`),
                name: result?.name ?? validatedPayload.name,
                code: result?.code ?? validatedPayload.code,
                createdAt: result?.createdAt ?? validatedPayload.createdAt ?? timestamp,
                updatedAt: result?.updatedAt ?? validatedPayload.updatedAt ?? timestamp,
            };

            set((state) => {
                const existingIndex = state.departments.findIndex(
                    (item) => item?.id === newDepartment.id || (item?.code && newDepartment.code && item.code.toUpperCase() === newDepartment.code.toUpperCase())
                );

                const updatedDepartments = existingIndex >= 0
                    ? state.departments.map((item, index) => index === existingIndex ? newDepartment : item)
                    : [...state.departments.filter(Boolean), newDepartment];

                return {
                    departments: updatedDepartments,
                    isLoading: false,
                    error: null,
                };
            });

            // Re-fetch with SERVER_ONLY to ensure complete consistency with backend SQL
            get().fetchDepartments().catch(() => {});

            systemEventService.recordSystemEvent({
                entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DEPARTMENT,
                entityId: newDepartment.id,
                action: constants.AUDIT_LOGS_ACTION.CREATED,
                data: {
                    name: newDepartment.name,
                    code: newDepartment.code,
                    title: `Department Created: ${newDepartment.name} (${newDepartment.code})`,
                    description: `Department "${newDepartment.name}" (${newDepartment.code}) has been created in the institutional directory.`,
                },
                targetRoles: ['ADMINISTRATOR', 'COORDINATOR'],
                isMajor: true,
            }).catch(() => {});

            return newDepartment;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to insert department.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    updateDepartment: async (id, payload) => {
        set({ isLoading: true, error: null });

        try {
            const timestamp = new Date().toISOString();
            const existingDepartment = get().departments.find((item) => item?.id === id);
            const payloadWithDates = {
                name: payload.name ?? existingDepartment?.name,
                code: payload.code ?? existingDepartment?.code,
                ...payload,
                updatedAt: payload.updatedAt || timestamp,
            };
            const validatedPayload = mutationSchema.UpdateDepartmentSchema.parse(payloadWithDates);
            const result = await departmentService.updateDepartment(id, validatedPayload);

            const updatedDepartment = {
                ...existingDepartment,
                ...validatedPayload,
                ...result,
                id: id,
                name: result?.name ?? validatedPayload.name ?? existingDepartment?.name,
                code: result?.code ?? validatedPayload.code ?? existingDepartment?.code,
                updatedAt: result?.updatedAt ?? validatedPayload.updatedAt ?? timestamp,
            };

            set((state) => ({
                departments: state.departments.map((item) =>
                    item?.id === id ? updatedDepartment : item
                ),
                selectedDepartment: state.selectedDepartment?.id === id
                    ? updatedDepartment
                    : state.selectedDepartment,
                isLoading: false,
                error: null,
            }));

            get().fetchDepartments().catch(() => {});

            systemEventService.recordSystemEvent({
                entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DEPARTMENT,
                entityId: id,
                action: constants.AUDIT_LOGS_ACTION.UPDATED,
                data: {
                    name: updatedDepartment.name,
                    code: updatedDepartment.code,
                    title: `Department Updated: ${updatedDepartment.name} (${updatedDepartment.code})`,
                    description: `Department details for "${updatedDepartment.name}" (${updatedDepartment.code}) were updated.`,
                },
                targetRoles: ['ADMINISTRATOR', 'COORDINATOR'],
                isMajor: false,
            }).catch(() => {});

            return updatedDepartment;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update department.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteDepartment: async (id) => {
        const department = get().departments.find((d) => d.id === id);
        try {
            const { useUserStore } = await import('./useUserStore');
            const users = useUserStore.getState().users || [];
            const assignedUsers = users.filter((u) =>
                u.departmentId === id ||
                (department && (
                    u.department === department.name ||
                    u.department === `${department.code} — ${department.name}` ||
                    u.department === department.code
                ))
            );

            if (assignedUsers.length > 0) {
                const message = `Cannot delete department: ${assignedUsers.length} user(s) are currently assigned to this department. Reassign or remove them first.`;
                set({ error: message, isLoading: false });
                throw new Error(message);
            }
        } catch (checkError) {
            if (checkError.message?.startsWith('Cannot delete department')) {
                throw checkError;
            }
        }

        set({ isLoading: true, error: null });

        try {
            const isDeleted = await departmentService.deleteDepartment(id);

            if (isDeleted) {
                set((state) => ({
                    departments: state.departments.filter((item) => item.id !== id),
                    selectedDepartment: state.selectedDepartment?.id === id
                        ? null
                        : state.selectedDepartment,
                    isLoading: false,
                    error: null,
                }));
                get().fetchDepartments().catch(() => {});

                systemEventService.recordSystemEvent({
                    entityType: constants.AUDIT_LOGS_ENTITY_TYPE.DEPARTMENT,
                    entityId: id,
                    action: constants.AUDIT_LOGS_ACTION.DELETED,
                    data: {
                        id,
                        name: department?.name,
                        code: department?.code,
                        title: `Department Removed: ${department?.name || department?.code || id}`,
                        description: `Department "${department?.name || department?.code || id}" was removed from the institution directory.`,
                    },
                    targetRoles: ['ADMINISTRATOR', 'COORDINATOR'],
                    isMajor: true,
                }).catch(() => {});
            } else {
                set({ isLoading: false });
            }

            return isDeleted;
        } catch (error) {
            const message = error?.message ?? 'Failed to delete department.';
            set({ isLoading: false, error: message });
            
            throw error;
        }
    },

    // CONTROLS
    setSelectedDepartment: (department) => {
        set({ selectedDepartment: department });
    },

    clearError: () => {
        set({ error: null });
    },
}));


// --- EXPORTS ---
export { useDepartmentStore };
