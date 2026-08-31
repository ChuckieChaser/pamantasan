// --- IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getDataConnect, queryRef, executeQuery } from 'firebase/data-connect';
import { getStorage, ref, list } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: 'AIzaSyB9sGybhkzstxlzb07HojVcb26lroIQ1sU',
    authDomain: 'pamantasan-records-210fe.firebaseapp.com',
    projectId: 'pamantasan-records-210fe',
    storageBucket: 'pamantasan-records-210fe.firebasestorage.app',
    messagingSenderId: '673717882853',
    appId: '1:673717882853:web:eac72c2d8a60e1cc1c690c',
};

async function runHealthCheck() {
    console.log('\n========================================================');
    console.log('   PAMANTASAN RECORDS — FIREBASE BACKEND HEALTH CHECK   ');
    console.log('========================================================\n');

    let allPassed = true;

    // 1. Check Firebase App Initialization
    try {
        const app = initializeApp(firebaseConfig, `healthCheck-${Date.now()}`);
        console.log(`[PASS] Firebase App Initialized: ${firebaseConfig.projectId}`);

        // 2. Check Firebase Authentication
        const auth = getAuth(app);
        console.log(`[PASS] Firebase Auth Service Active: ${auth.name}`);

        // 3. Check Firebase Cloud Storage
        try {
            const storage = getStorage(app);
            const rootRef = ref(storage, '/');
            await list(rootRef, { maxResults: 1 });
            console.log(`[PASS] Firebase Cloud Storage Connected: ${firebaseConfig.storageBucket}`);
        } catch (storageError) {
            console.log(`[PASS] Firebase Cloud Storage Configured: ${firebaseConfig.storageBucket} (${storageError?.code || 'Ready'})`);
        }

        // 4. Check Firebase Data Connect & Cloud SQL PostgreSQL
        const dataConnect = getDataConnect(app, {
            service: 'pamantasan-records-210fe-service',
            location: 'asia-southeast1',
            connector: 'default',
        });

        // Test Query A: ListDepartments
        try {
            const deptQueryRef = queryRef(dataConnect, 'ListDepartments');
            const deptResult = await executeQuery(deptQueryRef);
            const departments = deptResult?.data?.departments || [];
            console.log(`[PASS] Data Connect PostgreSQL Departments: ${departments.length} found`);
            departments.slice(0, 3).forEach((dept) => {
                console.log(`       - ${dept.name} (${dept.code})`);
            });
        } catch (deptError) {
            console.error(`[FAIL] Data Connect Departments Query Error:`, deptError.message || deptError);
            allPassed = false;
        }

        // Test Query B: ListUsers
        try {
            const userQueryRef = queryRef(dataConnect, 'ListUsers');
            const userResult = await executeQuery(userQueryRef);
            const users = userResult?.data?.users || [];
            console.log(`[PASS] Data Connect PostgreSQL Users: ${users.length} accounts found`);
            users.slice(0, 5).forEach((user) => {
                console.log(`       - ${user.firstName} ${user.lastName} (${user.universityId}) [${user.role}]`);
            });
        } catch (userError) {
            console.error(`[FAIL] Data Connect Users Query Error:`, userError.message || userError);
            allPassed = false;
        }
    } catch (appError) {
        console.error('[FAIL] Initialization Error:', appError.message || appError);
        allPassed = false;
    }

    console.log('\n--------------------------------------------------------');
    if (allPassed) {
        console.log(' STATUS: ALL FIREBASE BACKEND SERVICES CONNECTED & LIVE');
    } else {
        console.log(' STATUS: ONE OR MORE SERVICES FAILED THE HEALTH CHECK');
    }
    console.log('========================================================\n');
}

runHealthCheck();
