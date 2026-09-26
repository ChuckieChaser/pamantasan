// --- IMPORTS ---
import { CoordinatorExplorer } from '../features/coordinator/components/CoordinatorExplorer';
import { useAuth } from '../features/auth/hooks/useAuth';


// --- COMPONENTS ---
export const CoordinatorPage = () => {
    const { currentUser } = useAuth();

    return (
        <div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <CoordinatorExplorer currentUserId={currentUser?.id} />
        </div>
    );
};
