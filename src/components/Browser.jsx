// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    Plus,
    Folder,
    FileText,
    ChevronRight,
    MoreVertical,
    Download,
    Trash2,
    Eye,
    Edit3,
    Share2,
    Building2,
    Users as UsersIcon,
    UserCheck,
    Archive,
    Clock,
    Shield,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    User,
    Calendar,
    HardDrive,
} from 'lucide-react';
import { CardContainer } from './Container';
import { PrimaryButton, SecondaryButton } from './Button';
import { SearchField, ComboField } from './Fields';
import { ViewSelection } from './Selections';
import {
    Badge,
    SuccessBadge,
    ErrorBadge,
    WarningBadge,
    InformationBadge,
    RoleBadge,
} from './Badge';

// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-4 w-4 shrink-0';
const LARGE_ICON_STYLE = 'h-5 w-5 shrink-0';

const VIEW_OPTIONS = [
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
    { value: 'table', label: 'Table' },
];

// --- COMPONENTS ---

// 1. UNIFIED BROWSER COMPONENT
const Browser = ({
    resourceName = 'documents',
    title,
    description,
    data = [],
    columns = [],
    filterOptions = [],
    breadcrumbs = null,
    onBreadcrumbClick,
    onAddItem,
    addItemLabel = 'Add New',
    addItemIcon = Plus,
    searchPlaceholder = 'Search records...',
    initialView = 'table',
    className,
    ...props
}) => {
    // STATES
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState([]);
    const [currentView, setCurrentView] = useState(initialView);

    // HANDLERS
    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    const handleSearchClear = () => {
        setSearchQuery('');
    };

    const handleFilterChange = (updatedFilters) => {
        setSelectedFilters(updatedFilters);
    };

    const handleViewChange = (viewValue) => {
        setCurrentView(viewValue);
    };

    const handleAddClick = () => {
        onAddItem?.();
    };

    // DERIVED VALUES
    const filteredData = useMemo(() => {
        return data.filter((item) => {
            // Search query matching across title, subtitle, metadata
            const matchesSearch = searchQuery.trim() === '' || [
                item.title,
                item.subtitle,
                item.description,
                item.department,
                item.email,
                item.role,
                item.status,
            ].some((field) => field && String(field).toLowerCase().includes(searchQuery.toLowerCase()));

            // Filter tags/status matching
            const matchesFilter = selectedFilters.length === 0 || (
                item.tags?.some((tag) => selectedFilters.includes(tag)) ||
                (item.status && selectedFilters.includes(item.status)) ||
                (item.role && selectedFilters.includes(item.role)) ||
                (item.category && selectedFilters.includes(item.category))
            );

            return matchesSearch && matchesFilter;
        });
    }, [data, searchQuery, selectedFilters]);

    // RENDER
    return (
        <div
            className={`flex flex-col gap-4 w-full text-text ${className ?? ''}`.trim()}
            {...props}
        >
            {/* HEADER & BREADCRUMBS BANNER (BREADCRUMBS ONLY RENDERED WHEN PROVIDED) */}
            <div className="flex flex-col gap-2 border-b border-surface-border pb-4">
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav className="flex items-center gap-1.5 text-xs text-text-muted pb-1">
                        {breadcrumbs.map((breadcrumb, index) => {
                            const isLast = index === breadcrumbs.length - 1;
                            return (
                                <div
                                    key={breadcrumb.id ?? breadcrumb.label}
                                    className="flex items-center gap-1.5"
                                >
                                    {index > 0 && (
                                        <ChevronRight className="h-3 w-3 text-text-muted" />
                                    )}
                                    {isLast ? (
                                        <span className="font-semibold text-text">
                                            {breadcrumb.label}
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onBreadcrumbClick?.(breadcrumb, index)}
                                            className="hover:text-text transition-colors cursor-pointer"
                                        >
                                            {breadcrumb.label}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                )}

                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold">{title ?? getResourceTitle(resourceName)}</h1>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-surface-hover text-text-muted border border-surface-border font-medium">
                                {filteredData.length} records
                            </span>
                        </div>
                        {description && (
                            <p className="text-text-muted text-xs">{description}</p>
                        )}
                    </div>

                    {/* PRIMARY ACTION (ADD ITEM) */}
                    {onAddItem && (
                        <PrimaryButton
                            label={addItemLabel}
                            leadingIcon={addItemIcon}
                            onClick={handleAddClick}
                        />
                    )}
                </div>
            </div>

            {/* UNIFIED ACTION CONTROL STRIP (SEARCH, COMBO FILTER, VIEW SELECTION) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-surface-border">
                <div className="flex-1 max-w-sm">
                    <SearchField
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onClear={handleSearchClear}
                        placeholder={searchPlaceholder}
                    />
                </div>

                <div className="flex items-center gap-2.5">
                    {filterOptions.length > 0 && (
                        <div className="w-48 sm:w-56">
                            <ComboField
                                values={selectedFilters}
                                options={filterOptions}
                                onChange={handleFilterChange}
                                placeholder="Filter criteria..."
                            />
                        </div>
                    )}

                    <ViewSelection
                        value={currentView}
                        options={VIEW_OPTIONS}
                        onChange={handleViewChange}
                    />
                </div>
            </div>

            {/* CONTENT AREA: LIST, GRID, OR TABLE VIEW */}
            {filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-lg border border-surface-border text-center gap-2">
                    <span className="text-sm font-semibold text-text">No records found</span>
                    <p className="text-xs text-text-muted max-w-sm">
                        No matching entries found for "{searchQuery}". Try modifying your search or filter filters.
                    </p>
                    {searchQuery && (
                        <SecondaryButton
                            label="Clear search"
                            onClick={handleSearchClear}
                            className="mt-2"
                        />
                    )}
                </div>
            ) : currentView === 'grid' ? (
                <BrowserGridView
                    data={filteredData}
                    resourceName={resourceName}
                />
            ) : currentView === 'list' ? (
                <BrowserListView
                    data={filteredData}
                    resourceName={resourceName}
                />
            ) : (
                <BrowserTableView
                    data={filteredData}
                    columns={columns}
                    resourceName={resourceName}
                />
            )}
        </div>
    );
};

// 2. GRID VIEW RENDERER
const BrowserGridView = ({ data, resourceName }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((item) => (
                <CardContainer
                    key={item.id}
                    className="p-4 gap-3 justify-between hover:border-accent-border transition-colors cursor-pointer group"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-surface-hover text-accent group-hover:bg-accent-background transition-colors">
                                {renderItemIcon(item, resourceName)}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-sm text-text truncate">
                                    {item.title}
                                </span>
                                {item.subtitle && (
                                    <span className="text-xs text-text-muted truncate">
                                        {item.subtitle}
                                    </span>
                                )}
                            </div>
                        </div>

                        {renderItemBadge(item)}
                    </div>

                    {item.description && (
                        <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                            {item.description}
                        </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-text-muted border-t border-surface-border pt-2.5">
                        <span className="truncate">{item.metadata ?? item.department ?? item.date}</span>
                        <button
                            type="button"
                            className="text-text-muted hover:text-text p-1 cursor-pointer"
                            title="More options"
                        >
                            <MoreVertical className={ICON_STYLE} />
                        </button>
                    </div>
                </CardContainer>
            ))}
        </div>
    );
};

// 3. LIST VIEW RENDERER
const BrowserListView = ({ data, resourceName }) => {
    return (
        <div className="flex flex-col gap-2">
            {data.map((item) => (
                <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface border border-surface-border hover:bg-surface-hover transition-colors gap-4"
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-md bg-surface-hover text-accent shrink-0">
                            {renderItemIcon(item, resourceName)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-semibold text-sm text-text truncate">
                                {item.title}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-text-muted truncate">
                                {item.subtitle && <span>{item.subtitle}</span>}
                                {item.department && <span>· {item.department}</span>}
                                {item.date && <span>· {item.date}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {renderItemBadge(item)}
                        <button
                            type="button"
                            className="text-text-muted hover:text-text p-1.5 rounded hover:bg-surface transition-colors cursor-pointer"
                            title="Item actions"
                        >
                            <MoreVertical className={ICON_STYLE} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

// 4. TABLE VIEW RENDERER
const BrowserTableView = ({ data, columns = [], resourceName }) => {
    // Default columns if not provided
    const effectiveColumns = columns.length > 0
        ? columns
        : [
              { key: 'title', label: 'Name / Title' },
              { key: 'subtitle', label: 'Identifier' },
              { key: 'department', label: 'Department / Unit' },
              { key: 'status', label: 'Status' },
              { key: 'date', label: 'Date Modified' },
          ];

    return (
        <div className="w-full overflow-x-auto rounded-lg border border-surface-border bg-surface">
            <table className="w-full text-left text-xs border-collapse">
                <thead>
                    <tr className="border-b border-surface-border bg-surface-hover font-semibold text-text-muted">
                        {effectiveColumns.map((column) => (
                            <th
                                key={column.key}
                                className="px-4 py-3 font-medium"
                            >
                                {column.label}
                            </th>
                        ))}
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                    {data.map((item) => (
                        <tr
                            key={item.id}
                            className="hover:bg-surface-hover transition-colors"
                        >
                            {effectiveColumns.map((column) => (
                                <td
                                    key={column.key}
                                    className="px-4 py-3 text-text"
                                >
                                    {column.key === 'title' ? (
                                        <div className="flex items-center gap-2.5">
                                            {renderItemIcon(item, resourceName)}
                                            <span className="font-semibold">{item.title}</span>
                                        </div>
                                    ) : column.key === 'status' ? (
                                        renderItemBadge(item)
                                    ) : column.key === 'role' && item.role ? (
                                        <RoleBadge role={item.role.toLowerCase()} />
                                    ) : (
                                        <span className="text-text-muted truncate">
                                            {item[column.key] ?? '—'}
                                        </span>
                                    )}
                                </td>
                            ))}
                            <td className="px-4 py-3 text-right">
                                <button
                                    type="button"
                                    className="text-text-muted hover:text-text p-1 cursor-pointer"
                                    title="Row options"
                                >
                                    <MoreVertical className={ICON_STYLE} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export {
    Browser,
    BrowserGridView,
    BrowserListView,
    BrowserTableView,
};

export default Browser;

// --- HELPERS ---
function getResourceTitle(resourceName) {
    const titles = {
        users: 'Users Management',
        departments: 'Academic & Administrative Departments',
        coordinator_requests: 'Coordinator Requests',
        document_requests: 'Document Requests',
        documents: 'Documents Explorer',
        archives: 'Archived Records',
    };

    return titles[resourceName] ?? 'Resource Browser';
}

function renderItemIcon(item, resourceName) {
    if (item.isFolder) {
        return <Folder className={LARGE_ICON_STYLE} />;
    }

    if (resourceName === 'users') {
        return <User className={LARGE_ICON_STYLE} />;
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
}

function renderItemBadge(item) {
    if (item.role) {
        return <RoleBadge role={item.role.toLowerCase()} />;
    }

    if (item.status === 'Approved' || item.status === 'Active' || item.status === 'Published') {
        return <SuccessBadge label={item.status} />;
    }

    if (item.status === 'Pending' || item.status === 'In Review' || item.status === 'Under Review') {
        return <WarningBadge label={item.status} />;
    }

    if (item.status === 'Rejected' || item.status === 'Archived' || item.status === 'Offline') {
        return <ErrorBadge label={item.status} />;
    }

    if (item.status === 'Processing' || item.status === 'Syncing') {
        return <InformationBadge label={item.status} dot={true} />;
    }

    if (item.badge) {
        return <Badge variant="neutral" label={item.badge} />;
    }

    return null;
}
