// --- IMPORTS ---
import { useEffect } from 'react';
import { UserExplorer } from '../features/user/components/UserExplorer';
import { useDepartment } from '../features/department/hooks/useDepartment';


// --- COMPONENTS ---
export const UsersPage = () => {
    const { departments, handleGetDepartments } = useDepartment();

    useEffect(() => {
        handleGetDepartments();
    }, [handleGetDepartments]);

    return (
        <div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <UserExplorer departments={departments} />
        </div>
    );
};
