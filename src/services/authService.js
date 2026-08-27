// --- IMPORTS ---
import { MOCK_USERS, MOCK_DEPARTMENTS } from '../mocks';
import { USER_ROLES } from '../constants';

// --- CONFIGURATIONS ---
const STORAGE_KEY = 'dms_mock_active_user_id';
const authListeners = new Set();

// --- HELPERS ---
function formatUserRecord(rawUser) {
    if (!rawUser) {
        return null;
    }

    const department = MOCK_DEPARTMENTS.find(
        (dept) => dept.id === rawUser.department_id
    );

    return {
        id: rawUser.id,
        university_id: rawUser.university_id,
        universityId: rawUser.university_id,
        first_name: rawUser.first_name,
        last_name: rawUser.last_name,
        name: `${rawUser.first_name} ${rawUser.last_name}`,
        email: rawUser.email,
        role: rawUser.role ?? USER_ROLES.MEMBER,
        title: rawUser.title ?? 'University Member',
        department_id: rawUser.department_id,
        department: department?.name ?? 'College of Computer Studies (CCS)',
        department_code: department?.code ?? 'CCS',
        avatar_path: rawUser.avatar_path ?? null,
        status: rawUser.status ?? 'VERIFIED',
        created_at: rawUser.created_at,
        updated_at: rawUser.updated_at,
    };
}

function getStoredUser() {
    try {
        const storedId = localStorage.getItem(STORAGE_KEY);
        if (storedId === 'signed_out') {
            return null;
        }
        if (storedId) {
            const foundUser = MOCK_USERS.find((user) => user.id === storedId);
            if (foundUser) {
                return formatUserRecord(foundUser);
            }
        }
    } catch {
        // Fallback gracefully on storage access restriction
    }

    // Default to primary administrator mock user on first session
    return formatUserRecord(MOCK_USERS[0]);
}

function notifyListeners(user) {
    authListeners.forEach((listener) => {
        try {
            listener(user);
        } catch {
            // Guard against listener execution failure
        }
    });
}

// --- MOCK AUTHENTICATION SERVICE ---
const authService = {
    loginWithEmail: async (email, password) => {
        return authService.loginWithUniversityId(email, password);
    },

    loginWithUniversityId: async (universityId, password) => {
        const cleanInput = (universityId ?? '').trim().toLowerCase();
        const cleanNormalized = cleanInput.replace(/-/g, '');

        const matchedUser = MOCK_USERS.find((user) => {
            const userUniId = (user.university_id ?? '').toLowerCase();
            const userNormalizedUniId = userUniId.replace(/-/g, '');
            const userEmail = (user.email ?? '').toLowerCase();

            return (
                userUniId === cleanInput ||
                userNormalizedUniId === cleanNormalized ||
                userEmail === cleanInput
            );
        });

        if (!matchedUser) {
            throw new Error(`No account found matching "${universityId}". Use a valid mock University ID like 20-00001.`);
        }

        const formattedUser = formatUserRecord(matchedUser);

        try {
            localStorage.setItem(STORAGE_KEY, formattedUser.id);
        } catch {
            // Storage access guard
        }

        notifyListeners(formattedUser);
        return formattedUser;
    },

    loginWithGoogle: async () => {
        // Sign in as default mock administrator
        const defaultUser = formatUserRecord(MOCK_USERS[0]);

        try {
            localStorage.setItem(STORAGE_KEY, defaultUser.id);
        } catch {
            // Storage access guard
        }

        notifyListeners(defaultUser);
        return defaultUser;
    },

    logout: async () => {
        try {
            localStorage.setItem(STORAGE_KEY, 'signed_out');
        } catch {
            // Storage access guard
        }

        notifyListeners(null);
    },

    onAuthStateChanged: (callback) => {
        authListeners.add(callback);

        // Immediate invocation with current mock user
        const currentUser = getStoredUser();
        callback(currentUser);

        return () => {
            authListeners.delete(callback);
        };
    },

    getCurrentUser: () => {
        return getStoredUser();
    },

    switchMockUserById: (userId) => {
        const targetUser = MOCK_USERS.find((user) => user.id === userId);
        if (!targetUser) {
            return null;
        }

        const formattedUser = formatUserRecord(targetUser);
        try {
            localStorage.setItem(STORAGE_KEY, formattedUser.id);
        } catch {
            // Storage access guard
        }

        notifyListeners(formattedUser);
        return formattedUser;
    },
};

export {
    authService,
    formatUserRecord,
};

export default authService;
