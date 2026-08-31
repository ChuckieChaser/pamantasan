// --- IMPORTS ---
import { create } from 'zustand';
import {
    DepartmentInsertSchema,
    DepartmentUpdateSchema,
} from '../schemas';
import { DEFAULT_DEPARTMENTS } from '../constants';
import { departmentService } from '../services';

// --- STORE DEFINITION ---
const useDepartmentStore = create((set, get) => ({
    // STATE
    departments: [...DEFAULT_DEPARTMENTS],
    selectedDepartment: null,
    isLoading: false,
    error: null,

    // ACTIONS
    fetchDepartments: async () => {
        set({ isLoading: true, error: null });

        try {
            let liveDepartments = await departmentService.fetchDepartments();

            // Auto-seed missing canonical colleges into PostgreSQL
            const existingCodes = new Set(liveDepartments.map((d) => d.code));
            const missingColleges = DEFAULT_DEPARTMENTS.filter((d) => !existingCodes.has(d.code));

            if (missingColleges.length > 0) {
                for (const missing of missingColleges) {
                    try {
                        await departmentService.createDepartment({
                            name: missing.name,
                            code: missing.code,
                        });
                    } catch {
                        // Ignore race condition
                    }
                }
                liveDepartments = await departmentService.fetchDepartments();
            }

            const combinedMap = new Map();
            DEFAULT_DEPARTMENTS.forEach((dept) => {
                combinedMap.set(dept.code, dept);
            });
            liveDepartments.forEach((dept) => {
                const existing = combinedMap.get(dept.code);
                if (existing) {
                    combinedMap.set(dept.code, { ...existing, ...dept });
                } else {
                    combinedMap.set(dept.code || dept.id, dept);
                }
            });

            const mergedList = Array.from(combinedMap.values());
            set({ departments: mergedList, isLoading: false });
            return mergedList;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch departments.';
            set({ departments: [...DEFAULT_DEPARTMENTS], isLoading: false, error: errorMessage });
            return [...DEFAULT_DEPARTMENTS];
        }
    },

    fetchDepartmentById: async (departmentId) => {
        set({ isLoading: true, error: null });

        try {
            let department = get().departments.find((item) => item.id === departmentId);
            if (!department) {
                department = await departmentService.fetchDepartmentById(departmentId);
            }
            set({ selectedDepartment: department, isLoading: false });
            return department;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch department by identifier.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    createDepartment: async (departmentPayload) => {
        set({ isLoading: true, error: null });

        try {
            const validatedData = DepartmentInsertSchema.parse(departmentPayload);
            const created = await departmentService.createDepartment({
                name: validatedData.name,
                code: validatedData.code,
            });

            const newDepartment = created ?? {
                id: validatedData.id ?? `dept-${Date.now()}`,
                name: validatedData.name,
                code: validatedData.code,
            };

            set((state) => ({
                departments: [...state.departments, newDepartment],
                isLoading: false,
            }));

            return newDepartment;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to create department record.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    updateDepartment: async (departmentId, departmentUpdates) => {
        set({ isLoading: true, error: null });

        try {
            const validatedUpdates = DepartmentUpdateSchema.parse(departmentUpdates);
            await departmentService.updateDepartment(departmentId, validatedUpdates);

            const updatedDepartment = {
                ...(get().departments.find((item) => item.id === departmentId) ?? {}),
                ...validatedUpdates,
                id: departmentId,
            };

            set((state) => ({
                departments: state.departments.map((item) =>
                    item.id === departmentId ? updatedDepartment : item
                ),
                selectedDepartment: state.selectedDepartment?.id === departmentId
                    ? updatedDepartment
                    : state.selectedDepartment,
                isLoading: false,
            }));

            return updatedDepartment;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update department record.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    deleteDepartment: async (departmentId) => {
        set({ isLoading: true, error: null });

        try {
            await departmentService.deleteDepartment(departmentId);

            set((state) => ({
                departments: state.departments.filter((item) => item.id !== departmentId),
                selectedDepartment: state.selectedDepartment?.id === departmentId
                    ? null
                    : state.selectedDepartment,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to delete department record.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    setSelectedDepartment: (department) => {
        set({ selectedDepartment: department });
    },

    clearError: () => {
        set({ error: null });
    },
}));

export {
    useDepartmentStore,
};

export default useDepartmentStore;
