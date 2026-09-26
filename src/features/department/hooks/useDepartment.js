// --- USE DEPARTMENT HOOK ---
import { useCallback } from 'react';
import { useDepartmentStore } from '../departmentStore';


// --- HOOK ---

export const useDepartment = () => {
    const departments = useDepartmentStore((s) => s.departments);
    const selectedDepartment = useDepartmentStore((s) => s.selectedDepartment);
    const isLoading = useDepartmentStore((s) => s.isLoading);
    const isMutating = useDepartmentStore((s) => s.isMutating);
    const error = useDepartmentStore((s) => s.error);

    const fetchDepartments = useDepartmentStore((s) => s.fetchDepartments);
    const fetchDepartmentById = useDepartmentStore((s) => s.fetchDepartmentById);
    const fetchDepartmentByCode = useDepartmentStore((s) => s.fetchDepartmentByCode);
    const createDepartment = useDepartmentStore((s) => s.createDepartment);
    const updateDepartment = useDepartmentStore((s) => s.updateDepartment);
    const deleteDepartments = useDepartmentStore((s) => s.deleteDepartments);
    const setSelectedDepartment = useDepartmentStore((s) => s.setSelectedDepartment);
    const clearError = useDepartmentStore((s) => s.clearError);
    const reset = useDepartmentStore((s) => s.reset);


    // --- HANDLERS ---

    const handleFetchDepartments = useCallback(
        (filters) => fetchDepartments(filters),
        [fetchDepartments],
    );

    const handleFetchById = useCallback(
        (id) => fetchDepartmentById(id),
        [fetchDepartmentById],
    );

    const handleCreateDepartment = useCallback(
        (payload) => createDepartment(payload),
        [createDepartment],
    );

    const handleUpdateDepartment = useCallback(
        (id, payload) => updateDepartment(id, payload),
        [updateDepartment],
    );

    const handleDeleteDepartments = useCallback(
        (ids) => deleteDepartments(ids),
        [deleteDepartments],
    );


    return {
        // State
        departments,
        selectedDepartment,
        isLoading,
        isMutating,
        error,

        // Handlers
        handleFetchDepartments,
        handleFetchById,
        handleCreateDepartment,
        handleUpdateDepartment,
        handleDeleteDepartments,

        // Direct
        fetchDepartmentByCode,
        setSelectedDepartment,
        clearError,
        reset,
    };
};
