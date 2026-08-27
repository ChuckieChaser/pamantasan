// --- IMPORTS ---
import { create } from 'zustand';
import {
    DepartmentInsertSchema,
    DepartmentUpdateSchema,
} from '../schemas';
import { MOCK_DEPARTMENTS } from '../mocks';

// --- STORE DEFINITION ---
const useDepartmentStore = create((set, get) => ({
    // STATE
    departments: MOCK_DEPARTMENTS,
    selectedDepartment: null,
    isLoading: false,
    error: null,

    // ACTIONS
    fetchDepartments: async () => {
        set({ isLoading: true, error: null });

        try {
            const currentDepartments = get().departments;
            set({ isLoading: false });
            return currentDepartments;
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to fetch departments.';
            set({ isLoading: false, error: errorMessage });
            throw error;
        }
    },

    fetchDepartmentById: async (departmentId) => {
        set({ isLoading: true, error: null });

        try {
            const department = get().departments.find((item) => item.id === departmentId) ?? null;
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
            const timestamp = new Date().toISOString();

            const newDepartment = {
                id: validatedData.id ?? `d${Date.now().toString(16).padStart(7, '0')}-0000-4000-8000-000000000000`.slice(0, 36),
                name: validatedData.name,
                code: validatedData.code,
                created_at: timestamp,
                updated_at: timestamp,
            };

            // Enforce Unique Constraints
            const existingDepartment = get().departments.find(
                (item) => item.code.toUpperCase() === newDepartment.code.toUpperCase() ||
                          item.name.toLowerCase() === newDepartment.name.toLowerCase()
            );

            if (existingDepartment) {
                throw new Error(`A department with name "${newDepartment.name}" or code "${newDepartment.code}" already exists.`);
            }

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
            const targetDepartment = get().departments.find((item) => item.id === departmentId);

            if (!targetDepartment) {
                throw new Error(`Department with identifier "${departmentId}" was not found.`);
            }

            const updatedDepartment = {
                ...targetDepartment,
                ...validatedUpdates,
                updated_at: new Date().toISOString(),
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
