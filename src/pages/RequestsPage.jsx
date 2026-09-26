// --- IMPORTS ---
import { RequestExplorer } from '../features/request/components/RequestExplorer';
import { useAuth } from '../features/auth/hooks/useAuth';


// --- COMPONENTS ---
export const RequestsPage = () => {
    const { currentUser } = useAuth();

    return (
        <div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <RequestExplorer currentUserId={currentUser?.id} />
        </div>
    );
};
