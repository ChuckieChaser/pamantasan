// --- USE COORDINATOR HOOK ---
import { useCallback } from 'react';
import { useCoordinatorStore } from '../coordinatorStore';


// --- HOOK ---

export const useCoordinator = () => {
    const coordinatorRequests = useCoordinatorStore((s) => s.coordinatorRequests);
    const selectedCoordinatorRequest = useCoordinatorStore((s) => s.selectedCoordinatorRequest);
    const isLoading = useCoordinatorStore((s) => s.isLoading);
    const isMutating = useCoordinatorStore((s) => s.isMutating);
    const error = useCoordinatorStore((s) => s.error);

    const getCoordinatorRequests = useCoordinatorStore((s) => s.getCoordinatorRequests);
    const getCoordinatorRequestsByRequesterId = useCoordinatorStore((s) => s.getCoordinatorRequestsByRequesterId);
    const getCoordinatorRequestById = useCoordinatorStore((s) => s.getCoordinatorRequestById);
    const createCoordinatorRequest = useCoordinatorStore((s) => s.createCoordinatorRequest);
    const updateCoordinatorRequest = useCoordinatorStore((s) => s.updateCoordinatorRequest);
    const updateCoordinatorRequests = useCoordinatorStore((s) => s.updateCoordinatorRequests);
    const deleteCoordinatorRequests = useCoordinatorStore((s) => s.deleteCoordinatorRequests);
    const setSelectedCoordinatorRequest = useCoordinatorStore((s) => s.setSelectedCoordinatorRequest);
    const clearError = useCoordinatorStore((s) => s.clearError);
    const reset = useCoordinatorStore((s) => s.reset);


    // --- HANDLERS ---

    const handleGetCoordinatorRequests = useCallback(
        (filters) => getCoordinatorRequests(filters),
        [getCoordinatorRequests],
    );

    const handleGetCoordinatorRequestById = useCallback(
        (id) => getCoordinatorRequestById(id),
        [getCoordinatorRequestById],
    );

    const handleCreateCoordinatorRequest = useCallback(
        (payload) => createCoordinatorRequest(payload),
        [createCoordinatorRequest],
    );

    const handleUpdateCoordinatorRequest = useCallback(
        (id, payload) => updateCoordinatorRequest(id, payload),
        [updateCoordinatorRequest],
    );

    const handleDeleteCoordinatorRequests = useCallback(
        (ids) => deleteCoordinatorRequests(ids),
        [deleteCoordinatorRequests],
    );


    return {
        // State
        coordinatorRequests,
        selectedCoordinatorRequest,
        isLoading,
        isMutating,
        error,

        // Handlers
        handleGetCoordinatorRequests,
        handleGetCoordinatorRequestById,
        handleCreateCoordinatorRequest,
        handleUpdateCoordinatorRequest,
        handleDeleteCoordinatorRequests,

        // Direct
        getCoordinatorRequestsByRequesterId,
        updateCoordinatorRequests,
        setSelectedCoordinatorRequest,
        clearError,
        reset,
    };
};
