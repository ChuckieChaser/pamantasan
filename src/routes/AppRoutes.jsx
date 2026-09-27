// --- IMPORTS ---
import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import {
    LoginPage,
    ForgotPasswordPage,
    OnboardingPage,
    DashboardPage,
    DocumentsPage,
    UsersPage,
    DepartmentsPage,
    RequestsPage,
    CoordinatorPage,
    ArchivesPage,
    MobileSyncCapturePage,
    AccessDeniedPage,
    NotFoundPage,
} from '../pages';
import { USER_ROLE } from '../features/user/userConstants';


// --- CONFIGURATIONS ---
const ADMIN_ROLES = [
    USER_ROLE.ADMINISTRATOR,
    USER_ROLE.COORDINATOR,
];

const COORDINATOR_ROLES = [
    USER_ROLE.ADMINISTRATOR,
    USER_ROLE.COORDINATOR,
];


// --- COMPONENTS ---
export const AppRoutes = () => {
    return (
        <Routes>
            {/* PUBLIC GUEST ROUTES */}
            <Route element={<PublicRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* MOBILE SCAN LIVE SESSION */}
            <Route path="/scan/:sessionId" element={<MobileSyncCapturePage />} />

            {/* ONBOARDING FLOW */}
            <Route
                path="/onboarding"
                element={
                    <ProtectedRoute>
                        <OnboardingPage />
                    </ProtectedRoute>
                }
            />

            {/* PROTECTED WORKSPACE ROUTES */}
            <Route
                element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }
            >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/requests" element={<RequestsPage />} />
                <Route path="/archives" element={<ArchivesPage />} />

                {/* ROLE-RESTRICTED ADMINISTRATIVE MODULES */}
                <Route element={<ProtectedRoute requiredRoles={ADMIN_ROLES} />}>
                    <Route path="/departments" element={<DepartmentsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                </Route>

                <Route element={<ProtectedRoute requiredRoles={COORDINATOR_ROLES} />}>
                    <Route path="/coordinator" element={<CoordinatorPage />} />
                </Route>

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>

            {/* ACCESS DENIED & ERROR ROUTES */}
            <Route path="/denied" element={<AccessDeniedPage />} />
            <Route path="/access-denied" element={<AccessDeniedPage />} />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
};
