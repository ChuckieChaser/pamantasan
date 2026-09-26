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

    const fetchCoordinatorRequests = useCoordinatorStore((s) => s.fetchCoordinatorRequests);
    const fetchCoordinatorRequestsByRequesterId = useCoordinatorStore((s) => s.fetchCoordinatorRequestsByRequesterId);
    const fetchCoordinatorRequestById = useCoordinatorStore((s) => s.fetchCoordinatorRequestById);
    const createCoordinatorRequest = useCoordinatorStore((s) => s.createCoordinatorRequest);
    const updateCoordinatorRequest = useCoordinatorStore((s) => s.updateCoordinatorRequest);
    const updateCoordinatorRequests = useCoordinatorStore((s) => s.updateCoordinatorRequests);
    const deleteCoordinatorRequests = useCoordinatorStore((s) => s.deleteCoordinatorRequests);
    const setSelectedCoordinatorRequest = useCoordinatorStore((s) => s.setSelectedCoordinatorRequest);
    const clearError = useCoordinatorStore((s) => s.clearError);
    const reset = useCoordinatorStore((s) => s.reset);


    // --- HANDLERS ---

    const handleFetchRequests = useCallback(
        (filters) => fetchCoordinatorRequests(filters),
        [fetchCoordinatorRequests],
    );

    const handleFetchById = useCallback(
        (id) => fetchCoordinatorRequestById(id),
        [fetchCoordinatorRequestById],
    );

    const handleCreateRequest = useCallback(
        (payload) => createCoordinatorRequest(payload),
        [createCoordinatorRequest],
    );

    const handleUpdateRequest = useCallback(
        (id, payload) => updateCoordinatorRequest(id, payload),
        [updateCoordinatorRequest],
    );

    const handleDeleteRequests = useCallback(
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
        handleFetchRequests,
        handleFetchById,
        handleCreateRequest,
        handleUpdateRequest,
        handleDeleteRequests,

        // Direct
        fetchCoordinatorRequestsByRequesterId,
        updateCoordinatorRequests,
        setSelectedCoordinatorRequest,
        clearError,
        reset,
    };
};
