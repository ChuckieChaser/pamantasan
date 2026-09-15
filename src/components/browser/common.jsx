// --- IMPORTS ---
import {
    Archive,
    Building2,
    FileText,
    Folder,
    UserCheck,
} from 'lucide-react';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';


// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-4 w-4 shrink-0';
const LARGE_ICON_STYLE = 'h-5 w-5 shrink-0';


// --- HELPERS ---
const getResourceTitle = (resourceName) => {
    const titles = {
        users: 'Users Management',
        departments: 'Academic & Administrative Departments',
        coordinator_requests: 'Coordinator Requests',
        document_requests: 'Document Requests',
        documents: 'Documents Explorer',
        archives: 'Archived Records',
    };

    return titles[resourceName] ?? 'Resource Browser';
};

const renderItemIcon = (item, resourceName) => {
    if (item.isFolder) {
        return <Folder className={LARGE_ICON_STYLE} />;
    }

    if (resourceName === 'users' || item.university_id) {
        return (
            <Avatar
                src={item.avatar_path}
                alt={item.title ?? item.name}
                size="small"
                className="h-5 w-5"
            />
        );
    }

    if (resourceName === 'departments') {
        return <Building2 className={LARGE_ICON_STYLE} />;
    }

    if (resourceName === 'coordinator_requests') {
        return <UserCheck className={LARGE_ICON_STYLE} />;
    }

    if (resourceName === 'archives') {
        return <Archive className={LARGE_ICON_STYLE} />;
    }

    return <FileText className={LARGE_ICON_STYLE} />;
};

const renderItemBadge = (item) => {
    if (item.classification && item.classification !== '—') {
        const variant = item.classification === 'CONFIDENTIAL'
            ? 'error'
            : item.classification === 'RESTRICTED'
            ? 'warning'
            : item.classification === 'PRIVATE'
            ? 'information'
            : item.classification === 'PUBLIC'
            ? 'success'
            : 'neutral';
        return <Badge variant={variant} label={item.classification} />;
    }

    if (item.role) {
        const variant = item.role === 'ADMINISTRATOR'
            ? 'information'
            : item.role === 'DIRECTOR'
            ? 'success'
            : (item.role === 'COORDINATOR' || item.role === 'OFFICER')
            ? 'warning'
            : 'neutral';
        return <Badge variant={variant} label={item.role} />;
    }

    if (item.status) {
        const upper = String(item.status).toUpperCase();
        const variant = (upper.includes('VERIF') || upper.includes('APPROV') || upper.includes('RESOLV') || upper.includes('PUBLISH') || upper.includes('ACTIVE'))
            ? 'success'
            : (upper.includes('PENDING') || upper.includes('OPEN') || upper.includes('RESTRICT'))
            ? 'warning'
            : (upper.includes('REJECT') || upper.includes('SUSPEND') || upper.includes('CONFIDENT'))
            ? 'error'
            : 'neutral';
        return <Badge variant={variant} label={item.status} />;
    }

    if (item.badge) {
        return <Badge variant="neutral" label={item.badge} />;
    }

    return null;
};


// --- EXPORTS ---
export {
    ICON_STYLE,
    LARGE_ICON_STYLE,
    getResourceTitle,
    renderItemIcon,
    renderItemBadge,
};
