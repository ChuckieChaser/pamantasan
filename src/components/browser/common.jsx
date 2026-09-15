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
import { constants } from '../../constants';


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

    if (resourceName === 'users' || item.universityId) {
        return (
            <Avatar
                src={item.avatarPath}
                user={item.user ?? item}
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

const renderItemBadge = (item, columnKey) => {
    if (!item) return null;

    if (columnKey === 'role') {
        if (!item.role) return null;
        return <Badge variant="neutral" label={item.role} />;
    }

    if (columnKey === 'status') {
        if (!item.status || item.status === '—' || item.status === '--') {
            return <span className="text-text-muted whitespace-nowrap">—</span>;
        }
        const upper = String(item.status).toUpperCase();
        const variant = (upper.includes('VERIF') || upper.includes('APPROV') || upper.includes('RESOLV') || upper.includes('PUBLISH') || upper.includes('ACTIVE'))
            ? 'success'
            : upper.includes('PENDING_SSO')
            ? 'information'
            : (upper.includes('PENDING') || upper.includes('OPEN') || upper.includes('CONFIDENT'))
            ? 'warning'
            : (upper.includes('REJECT') || upper.includes('SUSPEND') || upper.includes('RESTRICT'))
            ? 'error'
            : 'neutral';
        return <Badge variant={variant} label={item.status} />;
    }

    if (columnKey === 'classification') {
        if (!item.classification || item.classification === '—' || item.classification === '--' || item.isFolder) {
            return <span className="text-text-muted whitespace-nowrap">—</span>;
        }
        const variant = item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC
            ? 'success'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE
            ? 'information'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL
            ? 'warning'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED
            ? 'error'
            : 'neutral';
        return <Badge variant={variant} label={item.classification} />;
    }

    if (!item.isFolder && item.classification && item.classification !== '—' && item.classification !== '--') {
        const variant = item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC
            ? 'success'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE
            ? 'information'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL
            ? 'warning'
            : item.classification === constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED
            ? 'error'
            : 'neutral';
        return <Badge variant={variant} label={item.classification} />;
    }

    if (item.status) {
        const upper = String(item.status).toUpperCase();
        const variant = (upper.includes('VERIF') || upper.includes('APPROV') || upper.includes('RESOLV') || upper.includes('PUBLISH') || upper.includes('ACTIVE'))
            ? 'success'
            : upper.includes('PENDING_SSO')
            ? 'information'
            : (upper.includes('PENDING') || upper.includes('OPEN') || upper.includes('RESTRICT'))
            ? 'warning'
            : (upper.includes('REJECT') || upper.includes('SUSPEND') || upper.includes('CONFIDENT'))
            ? 'error'
            : 'neutral';
        return <Badge variant={variant} label={item.status} />;
    }

    if (item.role) {
        return <Badge variant="neutral" label={item.role} />;
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
