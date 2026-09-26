// --- IMPORTS ---
import { UserExplorer } from '../features/user/components/UserExplorer';


// --- COMPONENTS ---
export const UsersPage = () => {
    return (
        <div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <UserExplorer />
        </div>
    );
};

export const UserPage = UsersPage;
