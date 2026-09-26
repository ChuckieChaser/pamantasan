// --- IMPORTS ---
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    FilePlus,
    FileText,
    Inbox,
    Plus,
    Shield,
    Upload,
    Users,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useDocument } from '../features/document/hooks/useDocument';
import { useDepartment } from '../features/department/hooks/useDepartment';
import { useRequest } from '../features/request/hooks/useRequest';
import { useCoordinator } from '../features/coordinator/hooks/useCoordinator';
import { AuditExplorer } from '../features/audit/components/AuditExplorer';
import { REQUEST_STATUS } from '../features/request/requestConstants';
import { COORDINATOR_STATUS } from '../features/coordinator/coordinatorConstants';


// --- COMPONENTS ---
export const DashboardPage = () => {
    // --- HOOKS & STATE ---
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { documents, handleGetDocumentsByParentId } = useDocument();
    const { departments, handleGetDepartments } = useDepartment();
    const { requests, handleGetRequests } = useRequest();
    const { coordinatorRequests, handleGetCoordinatorRequests } = useCoordinator();

    useEffect(() => {
        handleGetDocumentsByParentId({ parentId: null });
        handleGetDepartments();
        handleGetRequests();
        handleGetCoordinatorRequests();
    }, [handleGetDocumentsByParentId, handleGetDepartments, handleGetRequests, handleGetCoordinatorRequests]);

    // Metric summary stats
    const totalDocs = documents?.length ?? 0;
    const totalDepts = departments?.length ?? 0;
    const pendingRequests = requests?.filter((r) => r.status === REQUEST_STATUS.OPEN)?.length ?? 0;
    const pendingReviews = coordinatorRequests?.filter((r) => r.status === COORDINATOR_STATUS.PENDING)?.length ?? 0;

    // --- RENDER ---
    return (
        <div className="flex-1 w-full h-full p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="flex flex-col gap-6 max-w-7xl mx-auto">
                {/* Welcome & Quick Actions Banner */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-surface-border pb-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold tracking-tight text-text">
                            Welcome back, {currentUser?.givenName || 'Colleague'}
                        </h1>
                        <p className="text-sm text-text-muted">
                            Pamantasan Electronic Document Management System overview and recent repository operations.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <Button
                            variant="secondary"
                            leadingIcon={FilePlus}
                            onClick={() => navigate('/requests')}
                            className="flex-1 sm:flex-initial"
                        >
                            Request Document
                        </Button>
                        <Button
                            variant="primary"
                            leadingIcon={Upload}
                            onClick={() => navigate('/documents')}
                            className="flex-1 sm:flex-initial"
                        >
                            Upload File
                        </Button>
                    </div>
                </div>

                {/* Metrics Summary Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Card
                        onClick={() => navigate('/documents')}
                        className="p-4 sm:p-5 flex flex-col gap-3 cursor-pointer hover:border-accent transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                                Documents
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                                <FileText className="h-4 w-4" />
                            </div>
                        </div>
                        <span className="text-2xl font-bold text-text">
                            {totalDocs}
                        </span>
                        <span className="text-xs text-text-muted">
                            Root files and directories
                        </span>
                    </Card>

                    <Card
                        onClick={() => navigate('/departments')}
                        className="p-4 sm:p-5 flex flex-col gap-3 cursor-pointer hover:border-accent transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                                Departments
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-information/10 text-information flex items-center justify-center">
                                <Building2 className="h-4 w-4" />
                            </div>
                        </div>
                        <span className="text-2xl font-bold text-text">
                            {totalDepts}
                        </span>
                        <span className="text-xs text-text-muted">
                            Active university units
                        </span>
                    </Card>

                    <Card
                        onClick={() => navigate('/requests')}
                        className="p-4 sm:p-5 flex flex-col gap-3 cursor-pointer hover:border-accent transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                                Requests
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                                <Inbox className="h-4 w-4" />
                            </div>
                        </div>
                        <span className="text-2xl font-bold text-text">
                            {pendingRequests}
                        </span>
                        <span className="text-xs text-text-muted">
                            Active document requests
                        </span>
                    </Card>

                    <Card
                        onClick={() => navigate('/coordinator')}
                        className="p-4 sm:p-5 flex flex-col gap-3 cursor-pointer hover:border-accent transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                                Review Queue
                            </span>
                            <div className="h-8 w-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                                <Shield className="h-4 w-4" />
                            </div>
                        </div>
                        <span className="text-2xl font-bold text-text">
                            {pendingReviews}
                        </span>
                        <span className="text-xs text-text-muted">
                            Coordinator pending review
                        </span>
                    </Card>
                </div>

                {/* Audit Trail Section */}
                <div className="flex flex-col gap-4 pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-text">
                                Real-Time System Audit Trail
                            </h2>
                            <p className="text-xs text-text-muted">
                                Continuous security, ingestion, and role modification activity log
                            </p>
                        </div>
                    </div>

                    <AuditExplorer />
                </div>
            </div>
        </div>
    );
};
