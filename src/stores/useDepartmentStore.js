// --- IMPORTS ---
import { create } from 'zustand';

import { mutationSchema } from '../schemas';
import { departmentService } from '../services';


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
            set({ departments: departments, isLoading: false, error: null });
            
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
            let department = get().departments.find((item) => item.id === id);

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
            let department = get().departments.find((item) => item.code === code);

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
            const validatedPayload = mutationSchema.InsertDepartmentSchema.parse(payload);
            const newDepartment = await departmentService.insertDepartment(validatedPayload);

            set((state) => ({
                departments: [...state.departments, newDepartment],
                isLoading: false,
                error: null,
            }));

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
            const validatedPayload = mutationSchema.UpdateDepartmentSchema.parse(payload);
            const updatedDepartment = await departmentService.updateDepartment(id, validatedPayload);

            set((state) => ({
                departments: state.departments.map((item) =>
                    item.id === id ? updatedDepartment : item
                ),
                selectedDepartment: state.selectedDepartment?.id === id
                    ? updatedDepartment
                    : state.selectedDepartment,
                isLoading: false,
                error: null,
            }));

            return updatedDepartment;
        } catch (error) {
            const message = error?.errors?.[0]?.message ?? error?.message ?? 'Failed to update department.';
            set({ isLoading: false, error: message });

            throw error;
        }
    },

    deleteDepartment: async (id) => {
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
