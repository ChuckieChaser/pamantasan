// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    FileText,
    Folder,
    Building2,
    Users as UsersIcon,
    User as UserIcon,
    Inbox,
    SearchX,
    ArrowUpRight,
    Lock,
    Shield,
    Globe,
    EyeOff,
} from 'lucide-react';
import { Badge } from '../Badge';
import { Container } from '../Container';
import { SegmentSelection } from '../Selections';
import { constants } from '../../constants';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'absolute left-0 top-full mt-2 z-[100] w-[calc(100vw-2rem)] sm:w-96 md:w-[32rem] max-w-[95vw]';

const getClassificationIcon = (classification) => {
    switch (classification) {
        case constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL:
            return Shield;
        case constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED:
            return Lock;
        case constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE:
            return EyeOff;
        case constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC:
        default:
            return Globe;
    }
};

const getClassificationBadgeVariant = (classification) => {
    switch (classification) {
        case constants.DOCUMENT_VERSIONS_CLASSIFICATION.CONFIDENTIAL:
            return 'warning';
        case constants.DOCUMENT_VERSIONS_CLASSIFICATION.RESTRICTED:
            return 'danger';
        case constants.DOCUMENT_VERSIONS_CLASSIFICATION.PRIVATE:
            return 'neutral';
        case constants.DOCUMENT_VERSIONS_CLASSIFICATION.PUBLIC:
            return 'success';
        default:
            return 'neutral';
    }
};

// --- COMPONENT ---
const GlobalSearchDropdown = ({
    isOpen = false,
    query = '',
    onClose,
    onSelectResult,
    documents = [],
    documentVersions = [],
    departments = [],
    users = [],
    requests = [],
    coordinatorRequests = [],
    documentRequests = [],
    className,
    ...props
}) => {
    // STATES
    const [activeFilter, setActiveFilter] = useState('all');

    const cleanQuery = (query || '').trim().toLowerCase();

    // DERIVED SEARCH RESULTS
    const searchResults = useMemo(() => {
        if (!cleanQuery) {
            return {
                documents: [],
                departments: [],
                users: [],
                coordinatorRequests: [],
                documentRequests: [],
                total: 0,
            };
        }

        // 1. Filter Documents & Folders
        const matchedDocs = (documents || [])
            .filter((doc) => {
                const nameMatch = doc.name?.toLowerCase().includes(cleanQuery);
                const commentMatch = doc.comment?.toLowerCase().includes(cleanQuery);

                const versions = (documentVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === doc.id
                );
                const summaryMatch = versions.some(
                    (v) =>
                        v.summary?.toLowerCase().includes(cleanQuery) ||
                        v.changeSummary?.toLowerCase().includes(cleanQuery)
                );

                return nameMatch || commentMatch || summaryMatch;
            })
            .slice(0, 5)
            .map((doc) => {
                const versions = (documentVersions || []).filter(
                    (v) => (v.document?.id ?? v.documentId) === doc.id
                );
                const latestVersion = versions[0];
                return {
                    id: doc.id,
                    type: 'document',
                    title: doc.name,
                    isFolder: Boolean(doc.isFolder),
                    isArchived: Boolean(doc.isArchived),
                    classification: latestVersion?.classification || constants.DOCUMENT_VERSIONS_CLASSIFICATION.UNCLASSIFIED,
                    version: latestVersion ? `v${latestVersion.version}.0` : 'v1.0',
                    comment: doc.comment || null,
                    summary: latestVersion?.summary || doc.comment || null,
                    raw: doc,
                };
            });

        // 2. Filter Departments
        const matchedDepts = (departments || [])
            .filter((dept) => {
                const nameMatch = dept.name?.toLowerCase().includes(cleanQuery);
                const codeMatch = dept.code?.toLowerCase().includes(cleanQuery);
                return nameMatch || codeMatch;
            })
            .slice(0, 4)
            .map((dept) => ({
                id: dept.id,
                type: 'department',
                title: dept.name,
                code: dept.code,
                raw: dept,
            }));

        // 3. Filter Users
        const matchedUsers = (users || [])
            .filter((u) => {
                const fullName = `${u.firstName || ''} ${u.middleName || ''} ${u.lastName || ''}`.toLowerCase();
                const emailMatch = u.email?.toLowerCase().includes(cleanQuery);
                const univIdMatch = u.universityId?.toLowerCase().includes(cleanQuery);
                const roleMatch = u.role?.toLowerCase().includes(cleanQuery);
                return fullName.includes(cleanQuery) || emailMatch || univIdMatch || roleMatch;
            })
            .slice(0, 4)
            .map((u) => ({
                id: u.id,
                type: 'user',
                title: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
                universityId: u.universityId,
                email: u.email,
                role: u.role,
                department: u.department?.name || u.department?.code || null,
                raw: u,
            }));

        // 4. Filter Coordinator Requests
        const effectiveCoordRequests = (coordinatorRequests && coordinatorRequests.length > 0)
            ? coordinatorRequests
            : (requests || []);

        const matchedCoordRequests = effectiveCoordRequests
            .filter((r) => {
                const actionMatch = r.action?.toLowerCase().includes(cleanQuery);
                const subjectMatch = r.subject?.toLowerCase().includes(cleanQuery);
                const requesterName = r.requesterName || `${r.requester?.firstName || ''} ${r.requester?.lastName || ''}`;
                const requesterMatch = requesterName.toLowerCase().includes(cleanQuery);
                return actionMatch || subjectMatch || requesterMatch;
            })
            .slice(0, 4)
            .map((r) => ({
                id: r.id,
                type: 'coordinator_request',
                title: r.subject || (r.action ? String(r.action).replace(/_/g, ' ') : 'Coordinator Request'),
                status: r.status,
                requester: r.requesterName || `${r.requester?.firstName || ''} ${r.requester?.lastName || ''}`.trim() || 'Coordinator',
                raw: r,
            }));

        // 5. Filter Document Requests
        const effectiveDocRequests = documentRequests || [];
        const matchedDocRequests = effectiveDocRequests
            .filter((r) => {
                const titleMatch = r.title?.toLowerCase().includes(cleanQuery);
                const purposeMatch = r.purpose?.toLowerCase().includes(cleanQuery);
                const requesterName = `${r.requester?.firstName || ''} ${r.requester?.lastName || ''}`;
                const requesterMatch = requesterName.toLowerCase().includes(cleanQuery);
                return titleMatch || purposeMatch || requesterMatch;
            })
            .slice(0, 4)
            .map((r) => ({
                id: r.id,
                type: 'document_request',
                title: r.title || 'Document Request',
                status: r.status,
                purpose: r.purpose || null,
                requester: `${r.requester?.firstName || ''} ${r.requester?.lastName || ''}`.trim() || 'Member',
                raw: r,
            }));

        const total =
            matchedDocs.length +
            matchedDepts.length +
            matchedUsers.length +
            matchedCoordRequests.length +
            matchedDocRequests.length;

        return {
            documents: matchedDocs,
            departments: matchedDepts,
            users: matchedUsers,
            coordinatorRequests: matchedCoordRequests,
            documentRequests: matchedDocRequests,
            total,
        };
    }, [documents, documentVersions, departments, users, requests, coordinatorRequests, documentRequests, cleanQuery]);

    // GUARD: Render nothing if closed or query is empty
    if (!isOpen || !cleanQuery) {
        return null;
    }

    const handleItemClick = (item) => {
        onSelectResult?.(item);
        onClose?.();
    };

    const composedClassName = `${BASE_STYLE} ${className ?? ''}`.trim();

    // 6 REQUESTED FILTER OPTIONS WITH NUMBERS
    const filterOptions = [
        { value: 'all', label: `All (${searchResults.total})` },
        { value: 'departments', label: `Departments (${searchResults.departments.length})` },
        { value: 'users', label: `Users (${searchResults.users.length})` },
        { value: 'documents', label: `Documents (${searchResults.documents.length})` },
        { value: 'coordinator requests', label: `Coordinator Requests (${searchResults.coordinatorRequests.length})` },
        { value: 'document requests', label: `Document Requests (${searchResults.documentRequests.length})` },
    ];

    const showAll = activeFilter === 'all';
    const showDepts = showAll || activeFilter === 'departments';
    const showUsers = showAll || activeFilter === 'users';
    const showDocs = showAll || activeFilter === 'documents';
    const showCoordReqs = showAll || activeFilter === 'coordinator requests';
    const showDocReqs = showAll || activeFilter === 'document requests';

    return (
        <div className={composedClassName} {...props}>
            <Container
                variant="card"
                className="p-2 gap-2 bg-surface border border-surface-border rounded-lg overflow-hidden animate-toast-in shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.75)] ring-1 ring-black/5 dark:ring-white/10"
            >
                {/* 1. ACTUAL SEGMENTED CONTROL IN SCROLLABLE BAR */}
                <div className="overflow-x-auto scrollbar-none pb-1 pt-0.5">
                    <SegmentSelection
                        value={activeFilter}
                        options={filterOptions}
                        onChange={setActiveFilter}
                        className="w-max"
                    />
                </div>

                {/* 2. RESULTS BODY */}
                <div className="max-h-96 overflow-y-auto flex flex-col gap-1 p-0.5">
                    {/* EMPTY STATE */}
                    {searchResults.total === 0 && (
                        <div className="p-8 flex flex-col items-center justify-center text-center gap-2 rounded-lg border border-dashed border-surface-border">
                            <div className="p-3 rounded-full bg-surface-hover text-text-muted">
                                <SearchX className="h-6 w-6" />
                            </div>
                            <span className="font-semibold text-sm text-text">
                                No records found for &quot;{query}&quot;
                            </span>
                            <span className="text-xs text-text-muted max-w-xs leading-relaxed">
                                Try searching by document name, summary keywords, department code, or personnel name.
                            </span>
                        </div>
                    )}

                    {/* SECTION: DOCUMENTS */}
                    {showDocs && searchResults.documents.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
                                <span className="shrink-0">Documents</span>
                                <div className="h-px bg-surface-border flex-1" />
                            </div>
                            {searchResults.documents.map((doc) => {
                                const DocIcon = doc.isFolder ? Folder : FileText;
                                const ClassIcon = getClassificationIcon(doc.classification);
                                const subtitle = doc.isFolder
                                    ? (doc.comment ? doc.comment : 'No comment')
                                    : doc.summary;

                                return (
                                    <div
                                        key={`doc-${doc.id}`}
                                        onClick={() => handleItemClick(doc)}
                                        className="p-2.5 rounded-lg bg-surface border border-surface-border hover:border-accent/40 hover:bg-surface-hover transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
                                    >
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                            <div className="p-2 rounded-lg bg-surface-hover group-hover:bg-accent/15 group-hover:text-accent transition-colors text-text-muted shrink-0 mt-0.5">
                                                <DocIcon className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
                                                        {doc.title}
                                                    </span>
                                                    {doc.isArchived && (
                                                        <Badge variant="neutral" size="xs" label="Archived" />
                                                    )}
                                                </div>
                                                {subtitle && (
                                                    <p className="text-[11px] text-text-muted line-clamp-1 leading-snug">
                                                        {subtitle}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {!doc.isFolder && (
                                                <Badge
                                                    variant={getClassificationBadgeVariant(doc.classification)}
                                                    size="xs"
                                                    label={doc.classification}
                                                    leadingIcon={ClassIcon}
                                                />
                                            )}
                                            <ArrowUpRight className="h-3.5 w-3.5 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* SECTION: DEPARTMENTS */}
                    {showDepts && searchResults.departments.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                <Building2 className="h-3.5 w-3.5 text-accent shrink-0" />
                                <span className="shrink-0">Departments</span>
                                <div className="h-px bg-surface-border flex-1" />
                            </div>
                            {searchResults.departments.map((dept) => (
                                <div
                                    key={`dept-${dept.id}`}
                                    onClick={() => handleItemClick(dept)}
                                    className="p-2.5 rounded-lg bg-surface border border-surface-border hover:border-accent/40 hover:bg-surface-hover transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg bg-surface-hover group-hover:bg-accent/15 group-hover:text-accent transition-colors text-text-muted shrink-0">
                                            <Building2 className="h-4 w-4" />
                                        </div>
                                        <span className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
                                            {dept.title}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge variant="neutral" size="xs" label={dept.code} />
                                        <ArrowUpRight className="h-3.5 w-3.5 text-text-muted group-hover:text-accent transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SECTION: USERS */}
                    {showUsers && searchResults.users.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                <UsersIcon className="h-3.5 w-3.5 text-accent shrink-0" />
                                <span className="shrink-0">Users</span>
                                <div className="h-px bg-surface-border flex-1" />
                            </div>
                            {searchResults.users.map((u) => (
                                <div
                                    key={`user-${u.id}`}
                                    onClick={() => handleItemClick(u)}
                                    className="p-2.5 rounded-lg bg-surface border border-surface-border hover:border-accent/40 hover:bg-surface-hover transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg bg-surface-hover group-hover:bg-accent/15 group-hover:text-accent transition-colors text-text-muted shrink-0">
                                            <UserIcon className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
                                                {u.title}
                                            </span>
                                            <span className="text-[10px] text-text-muted truncate">
                                                {u.universityId ? `${u.universityId} • ` : ''}{u.email}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge
                                            variant={u.role === constants.USERS_ROLE.ADMINISTRATOR ? 'warning' : 'neutral'}
                                            size="xs"
                                            label={u.role}
                                        />
                                        <ArrowUpRight className="h-3.5 w-3.5 text-text-muted group-hover:text-accent transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SECTION: COORDINATOR REQUESTS */}
                    {showCoordReqs && searchResults.coordinatorRequests.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                <Shield className="h-3.5 w-3.5 text-accent shrink-0" />
                                <span className="shrink-0">Coordinator Requests</span>
                                <div className="h-px bg-surface-border flex-1" />
                            </div>
                            {searchResults.coordinatorRequests.map((req) => (
                                <div
                                    key={`coord-req-${req.id}`}
                                    onClick={() => handleItemClick(req)}
                                    className="p-2.5 rounded-lg bg-surface border border-surface-border hover:border-accent/40 hover:bg-surface-hover transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg bg-surface-hover group-hover:bg-accent/15 group-hover:text-accent transition-colors text-text-muted shrink-0">
                                            <Shield className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
                                                {req.title}
                                            </span>
                                            <span className="text-[10px] text-text-muted truncate">
                                                Requester: {req.requester}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge
                                            variant={req.status === 'APPROVED' ? 'success' : req.status === 'REJECTED' ? 'error' : 'warning'}
                                            size="xs"
                                            label={req.status || 'Pending'}
                                        />
                                        <ArrowUpRight className="h-3.5 w-3.5 text-text-muted group-hover:text-accent transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SECTION: DOCUMENT REQUESTS */}
                    {showDocReqs && searchResults.documentRequests.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                <Inbox className="h-3.5 w-3.5 text-accent shrink-0" />
                                <span className="shrink-0">Document Requests</span>
                                <div className="h-px bg-surface-border flex-1" />
                            </div>
                            {searchResults.documentRequests.map((req) => (
                                <div
                                    key={`doc-req-${req.id}`}
                                    onClick={() => handleItemClick(req)}
                                    className="p-2.5 rounded-lg bg-surface border border-surface-border hover:border-accent/40 hover:bg-surface-hover transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-2xs"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg bg-surface-hover group-hover:bg-accent/15 group-hover:text-accent transition-colors text-text-muted shrink-0">
                                            <Inbox className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
                                                {req.title}
                                            </span>
                                            <span className="text-[10px] text-text-muted truncate">
                                                Requester: {req.requester} {req.purpose ? `• ${req.purpose}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Badge
                                            variant={req.status === 'APPROVED' || req.status === 'RESOLVED' ? 'success' : req.status === 'REJECTED' ? 'error' : 'warning'}
                                            size="xs"
                                            label={req.status || 'Pending'}
                                        />
                                        <ArrowUpRight className="h-3.5 w-3.5 text-text-muted group-hover:text-accent transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Container>
        </div>
    );
};

// --- EXPORTS ---
export { GlobalSearchDropdown };
export default GlobalSearchDropdown;
