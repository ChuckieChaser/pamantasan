// --- IMPORTS ---
import { queryRef, mutationRef, executeQuery, executeMutation } from 'firebase/data-connect';
import { dataConnect } from './firebase';

// --- CONFIGURATIONS ---
const OPERATION_TIMEOUT_MILLISECONDS = 15000;

// --- HELPERS ---
function createTimeoutPromise(milliseconds, operationName) {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Firebase Data Connect operation "${operationName}" timed out after ${milliseconds}ms.`));
        }, milliseconds);
    });
}

// --- SERVICE IMPLEMENTATION ---
const dataConnectService = {
    executeQuery: async (queryName, variables = {}) => {
        if (!dataConnect) {
            throw new Error('Firebase Data Connect is not initialized.');
        }

        const queryReference = queryRef(dataConnect, queryName, variables);
        const executionPromise = executeQuery(queryReference);

        const response = await Promise.race([
            executionPromise,
            createTimeoutPromise(OPERATION_TIMEOUT_MILLISECONDS, queryName),
        ]);

        return response?.data ?? null;
    },

    executeMutation: async (mutationName, variables = {}) => {
        if (!dataConnect) {
            throw new Error('Firebase Data Connect is not initialized.');
        }

        const mutationReference = mutationRef(dataConnect, mutationName, variables);
        const executionPromise = executeMutation(mutationReference);

        const response = await Promise.race([
            executionPromise,
            createTimeoutPromise(OPERATION_TIMEOUT_MILLISECONDS, mutationName),
        ]);

        return response?.data ?? null;
    },
};

export {
    dataConnectService,
};

export default dataConnectService;
