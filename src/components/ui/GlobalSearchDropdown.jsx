// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    FileText,
    Folder,
    Building2,
    Users as UsersIcon,
    User as UserIcon,
    Inbox,
    Sparkles,
    SearchX,
    ArrowUpRight,
    Lock,
    Shield,
    Globe,
    EyeOff,
} from 'lucide-react';
import { Badge } from '../Badge';
import { Container } from '../Container';
import { constants } from '../../constants';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 md:w-[32rem]';

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
    className,
    ...props
}) => {
    // STATES
    const [activeFilter, setActiveFilter] = useState('all');

    const cleanQuery = (query || '').trim().toLowerCase();

    // DERIVED SEARCH RESULTS
    const searchResults = useMemo(() => {
        if (!cleanQuery) {
            return { documents: [], departments: [], users: [], requests: [], total: 0 };
        }

        // 1. Filter Documents
        const matchedDocs = (documents || [])
            .filter((doc) => {
                const nameMatch = doc.name?.toLowerCase().includes(cleanQuery);
                const commentMatch = doc.comment?.toLowerCase().includes(cleanQuery);

                // Check associated versions for summary or text matches
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

        // 4. Filter Requests
        const matchedRequests = (requests || [])
            .filter((r) => {
                const actionMatch = r.action?.toLowerCase().includes(cleanQuery);
                const subjectMatch = r.subject?.toLowerCase().includes(cleanQuery);
                const requesterMatch = r.requesterName?.toLowerCase().includes(cleanQuery);
                return actionMatch || subjectMatch || requesterMatch;
            })
            .slice(0, 3)
            .map((r) => ({
                id: r.id,
                type: 'request',
                title: r.subject || (r.action ? String(r.action).replace(/_/g, ' ') : 'Request'),
                status: r.status,
                requester: r.requesterName || 'Member',
                raw: r,
            }));

        const total = matchedDocs.length + matchedDepts.length + matchedUsers.length + matchedRequests.length;

        return {
            documents: matchedDocs,
            departments: matchedDepts,
            users: matchedUsers,
            requests: matchedRequests,
            total,
        };
    }, [documents, documentVersions, departments, users, requests, cleanQuery]);

    // GUARD: Render nothing if closed or query is empty
    if (!isOpen || !cleanQuery) {
        return null;
    }

    const handleItemClick = (item) => {
        onSelectResult?.(item);
        onClose?.();
    };

    const composedClassName = `${BASE_STYLE} ${className ?? ''}`.trim();

    const showAll = activeFilter === 'all';
    const showDocs = showAll || activeFilter === 'documents';
    const showDepts = showAll || activeFilter === 'departments';
    const showUsers = showAll || activeFilter === 'users';
    const showReqs = showAll || activeFilter === 'requests';

    return (
        <div className={composedClassName} {...props}>
            <Container
                variant="card"
                className="p-0 gap-0 bg-surface border-surface-border shadow-2xl overflow-hidden rounded-xl animate-toast-in"
            >
                {/* 1. FILTER TABS BAR */}
                <div className="flex items-center gap-1 p-2 bg-surface-hover/60 border-b border-surface-border text-xs overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveFilter('all')}
                        className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                            activeFilter === 'all'
                                ? 'bg-accent text-text-inverted'
                                : 'text-text-muted hover:text-text hover:bg-surface'
                        }`}
                    >
                        All ({searchResults.total})
                    </button>
                    {searchResults.documents.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveFilter('documents')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                activeFilter === 'documents'
                                    ? 'bg-accent text-text-inverted'
                                    : 'text-text-muted hover:text-text hover:bg-surface'
                            }`}
                        >
                            <FileText className="h-3 w-3" />
                            <span>Documents ({searchResults.documents.length})</span>
                        </button>
                    )}
                    {searchResults.departments.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveFilter('departments')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                activeFilter === 'departments'
                                    ? 'bg-accent text-text-inverted'
                                    : 'text-text-muted hover:text-text hover:bg-surface'
                            }`}
                        >
                            <Building2 className="h-3 w-3" />
                            <span>Departments ({searchResults.departments.length})</span>
                        </button>
                    )}
                    {searchResults.users.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveFilter('users')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                activeFilter === 'users'
                                    ? 'bg-accent text-text-inverted'
                                    : 'text-text-muted hover:text-text hover:bg-surface'
                            }`}
                        >
                            <UsersIcon className="h-3 w-3" />
                            <span>Users ({searchResults.users.length})</span>
                        </button>
                    )}
                    {searchResults.requests.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setActiveFilter('requests')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                activeFilter === 'requests'
                                    ? 'bg-accent text-text-inverted'
                                    : 'text-text-muted hover:text-text hover:bg-surface'
                            }`}
                        >
                            <Inbox className="h-3 w-3" />
                            <span>Requests ({searchResults.requests.length})</span>
                        </button>
                    )}
                </div>

                {/* 2. RESULTS BODY */}
                <div className="max-h-96 overflow-y-auto divide-y divide-surface-border">
                    {/* EMPTY STATE */}
                    {searchResults.total === 0 && (
                        <div className="p-8 flex flex-col items-center justify-center text-center gap-2">
                            <div className="p-3 rounded-full bg-surface-hover text-text-muted">
                                <SearchX className="h-6 w-6" />
                            </div>
                            <span className="font-semibold text-sm text-text">
                                No records found for &quot;{query}&quot;
                            </span>
                            <span className="text-xs text-text-muted max-w-xs">
                                Try searching by document name, summary keywords, department code, or personnel name.
                            </span>
                        </div>
                    )}

                    {/* SECTION: DOCUMENTS */}
                    {showDocs && searchResults.documents.length > 0 && (
                        <div className="py-2">
                            <div className="px-3 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-accent" />
                                <span>Documents & Repository</span>
                            </div>
                            {searchResults.documents.map((doc) => {
                                const DocIcon = doc.isFolder ? Folder : FileText;
                                const ClassIcon = getClassificationIcon(doc.classification);
                                return (
                                    <div
                                        key={`doc-${doc.id}`}
                                        onClick={() => handleItemClick(doc)}
                                        className="px-3 py-2 hover:bg-surface-hover transition-colors cursor-pointer flex items-start justify-between gap-3 group"
                                    >
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                            <div className="p-1.5 rounded-md bg-surface-hover group-hover:bg-accent/15 group-hover:text-accent transition-colors text-text-muted shrink-0 mt-0.5">
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
                                                {doc.summary && (
                                                    <p className="text-[11px] text-text-muted line-clamp-1 leading-snug">
                                                        {doc.summary}
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
                                                    icon={ClassIcon}
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
                        <div className="py-2">
                            <div className="px-3 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-accent" />
                                <span>Departments</span>
                            </div>
                            {searchResults.departments.map((dept) => (
                                <div
                                    key={`dept-${dept.id}`}
                                    onClick={() => handleItemClick(dept)}
                                    className="px-3 py-2 hover:bg-surface-hover transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="p-1.5 rounded-md bg-surface-hover group-hover:bg-accent/15 group-hover:text-accent transition-colors text-text-muted shrink-0">
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
                        <div className="py-2">
                            <div className="px-3 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                <UsersIcon className="h-3.5 w-3.5 text-accent" />
                                <span>Users & Personnel</span>
                            </div>
                            {searchResults.users.map((u) => (
                                <div
                                    key={`user-${u.id}`}
                                    onClick={() => handleItemClick(u)}
                                    className="px-3 py-2 hover:bg-surface-hover transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="p-1.5 rounded-md bg-surface-hover group-hover:bg-accent/15 group-hover:text-accent transition-colors text-text-muted shrink-0">
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

                    {/* SECTION: REQUESTS */}
                    {showReqs && searchResults.requests.length > 0 && (
                        <div className="py-2">
                            <div className="px-3 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                <Inbox className="h-3.5 w-3.5 text-accent" />
                                <span>Governance Requests</span>
                            </div>
                            {searchResults.requests.map((req) => (
                                <div
                                    key={`req-${req.id}`}
                                    onClick={() => handleItemClick(req)}
                                    className="px-3 py-2 hover:bg-surface-hover transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className="p-1.5 rounded-md bg-surface-hover group-hover:bg-accent/15 group-hover:text-accent transition-colors text-text-muted shrink-0">
                                            <Inbox className="h-4 w-4" />
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
                                            variant={req.status === 'APPROVED' ? 'success' : 'warning'}
                                            size="xs"
                                            label={req.status}
                                        />
                                        <ArrowUpRight className="h-3.5 w-3.5 text-text-muted group-hover:text-accent transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. FOOTER TIPS */}
                <div className="px-3 py-2 bg-surface-hover/30 border-t border-surface-border flex items-center justify-between text-[10px] text-text-muted">
                    <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-accent" />
                        <span>Institutional Global Search</span>
                    </span>
                    <span>Press Esc or click outside to dismiss</span>
                </div>
            </Container>
        </div>
    );
};

export { GlobalSearchDropdown };
export default GlobalSearchDropdown;
