// --- IMPORTS ---
import { DocumentExplorer } from '../features/document/components/DocumentExplorer';
import { useAuth } from '../features/auth/hooks/useAuth';


// --- COMPONENTS ---
export const DocumentsPage = () => {
    const { currentUser } = useAuth();

    return (
        <div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <DocumentExplorer currentUserId={currentUser?.id} />
        </div>
    );
};

export const DocumentPage = DocumentsPage;
