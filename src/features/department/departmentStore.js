// --- DEPARTMENT STORE ---
import { create } from 'zustand';
import {
    getDepartments,
    getDepartmentById,
    getDepartmentByCode,
    createDepartment,
    updateDepartment,
    deleteDepartments,
} from './departmentService';


// --- STORE ---

export const useDepartmentStore = create((set, get) => ({
    // --- STATE ---
    departments: [],
    selectedDepartment: null,
    isLoading: false,
    isMutating: false,
    error: null,


    // --- QUERIES ---

    fetchDepartments: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const departments = await getDepartments(filters);
            set({ departments, isLoading: false });
            return departments;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch departments.' });
            return [];
        }
    },

    fetchDepartmentById: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const cached = get().departments.find((d) => d?.id === id);
            const department = cached ?? await getDepartmentById(id);
            set({ selectedDepartment: department, isLoading: false });
            return department;
        } catch (error) {
            set({ isLoading: false, error: error?.message ?? 'Failed to fetch department.' });
            return null;
        }
    },

    fetchDepartmentByCode: async (code) => {
        try {
            const cached = get().departments.find((d) => d?.code?.toUpperCase() === code?.toUpperCase());
            const department = cached ?? await getDepartmentByCode(code);
            set({ selectedDepartment: department });
            return department;
        } catch (error) {
            set({ error: error?.message ?? 'Failed to fetch department by code.' });
            return null;
        }
    },


    // --- MUTATIONS ---

    createDepartment: async (payload) => {
        set({ isMutating: true, error: null });
        try {
            const department = await createDepartment(payload);
            set((state) => ({
                departments: department ? [...state.departments, department] : state.departments,
                isMutating: false,
            }));
            return department;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to create department.' });
            throw error;
        }
    },

    updateDepartment: async (id, payload) => {
        set({ isMutating: true, error: null });
        try {
            const updated = await updateDepartment(id, payload);
            set((state) => ({
                departments: state.departments.map((d) => (d?.id === id ? { ...d, ...updated } : d)),
                selectedDepartment: state.selectedDepartment?.id === id ? { ...state.selectedDepartment, ...updated } : state.selectedDepartment,
                isMutating: false,
            }));
            return updated;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to update department.' });
            throw error;
        }
    },

    deleteDepartments: async (ids) => {
        set({ isMutating: true, error: null });
        try {
            const result = await deleteDepartments(ids);
            set((state) => ({
                departments: state.departments.filter((d) => !ids.includes(d?.id)),
                selectedDepartment: ids.includes(state.selectedDepartment?.id) ? null : state.selectedDepartment,
                isMutating: false,
            }));
            return result;
        } catch (error) {
            set({ isMutating: false, error: error?.message ?? 'Failed to delete departments.' });
            throw error;
        }
    },


    // --- CONTROLS ---

    setSelectedDepartment: (department) => set({ selectedDepartment: department }),

    clearError: () => set({ error: null }),

    reset: () => set({ departments: [], selectedDepartment: null, isLoading: false, isMutating: false, error: null }),
}));
