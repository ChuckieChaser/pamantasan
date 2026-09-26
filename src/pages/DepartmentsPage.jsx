// --- IMPORTS ---
import { DepartmentExplorer } from '../features/department/components/DepartmentExplorer';


// --- COMPONENTS ---
export const DepartmentsPage = () => {
    return (
        <div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <DepartmentExplorer />
        </div>
    );
};

export const DepartmentPage = DepartmentsPage;
