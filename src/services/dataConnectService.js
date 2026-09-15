// --- IMPORTS ---
import { queryRef, mutationRef, executeQuery, executeMutation } from 'firebase/data-connect';
import { dataConnect } from './firebase';


// --- CONFIGURATIONS ---
const OPERATION_TIMEOUT_MILLISECONDS = 15_000;


// --- SERVICES ---
const dataConnectService = {
    executeQuery: async (queryName, variables = {}) => {
        if (!dataConnect) {
            throw new Error('Firebase Data Connect is not initialized.');
        }

        const queryReference = queryRef(dataConnect, queryName, variables);
        const response = await executeWithTimeout(
            executeQuery(queryReference),
            OPERATION_TIMEOUT_MILLISECONDS,
            queryName
        );

        return response.data;
    },

    executeMutation: async (mutationName, variables = {}) => {
        if (!dataConnect) {
            throw new Error('Firebase Data Connect is not initialized.');
        }

        const mutationReference = mutationRef(dataConnect, mutationName, variables);
        const response = await executeWithTimeout(
            executeMutation(mutationReference),
            OPERATION_TIMEOUT_MILLISECONDS,
            mutationName
        );

        return response.data;
    },
};


// --- HELPERS ---
function executeWithTimeout(promise, milliseconds, operationName) {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Firebase Data Connect operation "${operationName}" timed out after ${milliseconds}ms.`));
        }, milliseconds);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}


// --- EXPORTS ---
export { dataConnectService };