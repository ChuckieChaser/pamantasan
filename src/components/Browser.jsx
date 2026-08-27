// --- IMPORTS ---
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    LayoutGrid,
    List,
    Table,
    MessageSquare,
    ArrowUpDown,
    Filter,
    History,
    ArrowDownAZ,
    ArrowUpAZ,
} from 'lucide-react';
import { CardContainer, DropdownContainer } from './Container';
import { PrimaryButton, SecondaryButton } from './Button';
import { SearchField, SelectField, ComboField } from './Fields';
import { ViewSelection, ToggleSelection } from './Selections';
import {
    Badge,
    SuccessBadge,
    ErrorBadge,
    WarningBadge,
    InformationBadge,
    RoleBadge,
    StatusBadge,
    ClassificationBadge,
} from './Badge';
import { UserAvatar } from './Avatar';
import { useDoubleClick } from '../hooks';
import {
    DOCUMENT_CLASSIFICATIONS,
    DOCUMENT_SHARE_STATUSES,
} from '../constants';

// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-4 w-4 shrink-0';
const LARGE_ICON_STYLE = 'h-5 w-5 shrink-0';

const DEFAULT_SORT_OPTIONS = [
    { value: 'date-desc', label: 'Recently Modified', icon: Clock },
    { value: 'date-asc', label: 'Oldest Modified', icon: History },
    { value: 'name-asc', label: 'Name (A to Z)', icon: ArrowDownAZ },
    { value: 'name-desc', label: 'Name (Z to A)', icon: ArrowUpAZ },
    { value: 'size-desc', label: 'Size (Largest)', icon: HardDrive },
    { value: 'type-asc', label: 'Folders First', icon: Folder },
];

const VIEW_OPTIONS = [
    { value: 'table', label: 'Table View', title: 'Table View', icon: Table },
    { value: 'list', label: 'List View', title: 'List View', icon: List },
    { value: 'grid', label: 'Grid View', title: 'Grid View', icon: LayoutGrid },
];

// --- COMPONENTS ---

// 1. UNIFIED BROWSER COMPONENT
const Browser = ({
    resourceName = 'documents',
    title,
    description,
    data = [],
    columns = [],
    sortOptions = DEFAULT_SORT_OPTIONS,
    sortBy,
    filterOptions = [],
    breadcrumbs = null,
    selectedItem = null,
    addItemLabel = 'Add New',
    addItemIcon = Plus,
    searchPlaceholder = 'Search records...',
    initialView = 'table',
    showArchiveToggle = false,
    isArchived = false,
    onSortChange,
    onBreadcrumbClick,
    onAddItem,
    onSelectItem,
    onDoubleClickItem,
    onOpenItem,
    onItemAction,
    onToggleArchived,
    className,
    ...props
}) => {
    // STATES
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilters, setSelectedFilters] = useState([]);
    const [internalSortBy, setInternalSortBy] = useState(sortBy ?? 'date-desc');
    const [currentView, setCurrentView] = useState(initialView);
    const [internalSelectedId, setInternalSelectedId] = useState(null);
    const [activeActionMenu, setActiveActionMenu] = useState(null);

    const activeSortBy = sortBy !== undefined ? sortBy : internalSortBy;

    // DERIVED SELECTION
    const selectedId = selectedItem?.id ?? internalSelectedId;

    // HOOKS: DISMISS PORTAL ACTION DROPDOWN ON OUTSIDE CLICK, SCROLL, RESIZE, OR ESCAPE
    useEffect(() => {
        if (!activeActionMenu) {
            return;
        }

        const handleDismiss = () => {
            setActiveActionMenu(null);
        };

        const handleKeyDown = (keyboardEvent) => {
            if (keyboardEvent.key === 'Escape') {
                setActiveActionMenu(null);
            }
        };

        window.addEventListener('click', handleDismiss);
        window.addEventListener('scroll', handleDismiss, true);
        window.addEventListener('resize', handleDismiss);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('click', handleDismiss);
            window.removeEventListener('scroll', handleDismiss, true);
            window.removeEventListener('resize', handleDismiss);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeActionMenu]);

    // DOUBLE CLICK HOOK
    const handleItemInteraction = useDoubleClick({
        onClick: (item) => {
            if (selectedId === item.id) {
                setInternalSelectedId(null);
                onSelectItem?.(null);
                return;
            }

            setInternalSelectedId(item.id);
            onSelectItem?.(item);
        },
        onDoubleClick: (item) => {
            onDoubleClickItem?.(item);
            onOpenItem?.(item);
        },
    });

    // HANDLERS
    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    const handleSearchClear = () => {
        setSearchQuery('');
    };

    const handleSortChange = (newSort) => {
        setInternalSortBy(newSort);
        onSortChange?.(newSort);
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

    const handleToggleActionMenu = (event, item) => {
        event?.stopPropagation();

        if (activeActionMenu?.id === item.id) {
            setActiveActionMenu(null);
            return;
        }

        const buttonRect = event.currentTarget.getBoundingClientRect();
        setActiveActionMenu({
            id: item.id,
            item,
            anchorRect: buttonRect,
        });
    };

    const handleActionClick = (event, actionKey, item) => {
        event?.stopPropagation();
        setActiveActionMenu(null);
        onItemAction?.(actionKey, item);
    };

    // DERIVED VALUES
    const filteredData = useMemo(() => {
        const filtered = data.filter((item) => {
            const matchesSearch = searchQuery.trim() === '' || [
                item.title,
                item.subtitle,
                item.description,
                item.department,
                item.classification,
                item.status,
                item.category,
                item.name,
                item.code,
                item.email,
                item.role,
                item.first_name,
                item.last_name,
                item.university_id,
                item.subject,
                item.action,
            ].some((field) => {
                return typeof field === 'string' && field.toLowerCase().includes(searchQuery.toLowerCase());
            });

            // Multi-category faceted filtering (AND across categories, OR within category)
            if (selectedFilters.length === 0) {
                return matchesSearch;
            }

            const activeOptionObjects = filterOptions.filter((option) =>
                selectedFilters.includes(option.value)
            );

            const activeCategoryMap = new Map();
            activeOptionObjects.forEach((option) => {
                const categoryName = option.category ?? 'General';
                if (!activeCategoryMap.has(categoryName)) {
                    activeCategoryMap.set(categoryName, []);
                }
                activeCategoryMap.get(categoryName).push(option.value);
            });

            const matchesCategoryFilters = Array.from(activeCategoryMap.values()).every(
                (categoryValues) => {
                    return categoryValues.some((filterValue) => {
                        return (
                            item.classification === filterValue ||
                            item.status === filterValue ||
                            item.role === filterValue ||
                            item.category === filterValue ||
                            item.department === filterValue ||
                            item.tags?.includes?.(filterValue)
                        );
                    });
                }
            );

            return matchesSearch && matchesCategoryFilters;
        });

        // Apply sorting
        return filtered.sort((itemA, itemB) => {
            if (activeSortBy === 'type-asc') {
                if (Boolean(itemA.isFolder) !== Boolean(itemB.isFolder)) {
                    return itemA.isFolder ? -1 : 1;
                }
            }

            if (activeSortBy === 'name-asc') {
                const nameA = itemA.title ?? itemA.name ?? itemA.subject ?? '';
                const nameB = itemB.title ?? itemB.name ?? itemB.subject ?? '';
                return nameA.localeCompare(nameB);
            }

            if (activeSortBy === 'name-desc') {
                const nameA = itemA.title ?? itemA.name ?? itemA.subject ?? '';
                const nameB = itemB.title ?? itemB.name ?? itemB.subject ?? '';
                return nameB.localeCompare(nameA);
            }

            if (activeSortBy === 'date-asc') {
                const timeA = new Date(itemA.updated_at ?? itemA.created_at ?? itemA.date ?? 0).getTime() || 0;
                const timeB = new Date(itemB.updated_at ?? itemB.created_at ?? itemB.date ?? 0).getTime() || 0;
                return timeA - timeB;
            }

            if (activeSortBy === 'size-desc') {
                const parseSize = (sizeStr) => {
                    if (!sizeStr) return 0;
                    if (sizeStr.includes('MB')) return parseFloat(sizeStr) * 1024 * 1024;
                    if (sizeStr.includes('KB')) return parseFloat(sizeStr) * 1024;
                    if (sizeStr.includes('items')) return parseInt(sizeStr, 10) * 1000;
                    return 0;
                };
                return parseSize(itemB.size) - parseSize(itemA.size);
            }

            // Default 'date-desc'
            const timeA = new Date(itemA.updated_at ?? itemA.created_at ?? itemA.date ?? 0).getTime() || 0;
            const timeB = new Date(itemB.updated_at ?? itemB.created_at ?? itemB.date ?? 0).getTime() || 0;
            if (timeA !== timeB) {
                return timeB - timeA;
            }

            const nameA = itemA.title ?? itemA.name ?? itemA.subject ?? '';
            const nameB = itemB.title ?? itemB.name ?? itemB.subject ?? '';
            return nameA.localeCompare(nameB);
        });
    }, [data, searchQuery, selectedFilters, filterOptions, activeSortBy]);

    const totalCount = filteredData.length;

    // RENDER
    return (
        <div className={`flex flex-col gap-5 text-text ${className ?? ''}`.trim()} {...props}>
            {/* HEADER AREA: TITLE, DESCRIPTION, BREADCRUMBS, AND PRIMARY ACTION */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
                <div className="flex flex-col gap-1.5">
                    {/* BREADCRUMB NAVIGATION */}
                    {breadcrumbs && breadcrumbs.length > 0 && (
                        <nav className="flex items-center gap-2 text-xs text-text-muted select-none flex-wrap">
                            {breadcrumbs.map((breadcrumb, index) => {
                                const isLast = index === breadcrumbs.length - 1;

                                return (
                                    <div key={breadcrumb.id ?? index} className="inline-flex items-center gap-2">
                                        {index > 0 && <ChevronRight className={ICON_STYLE} />}
                                        {isLast ? (
                                            <span className="font-semibold text-accent truncate max-w-48">
                                                {breadcrumb.label}
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onBreadcrumbClick?.(breadcrumb, index)}
                                                className="hover:text-text hover:underline transition-colors cursor-pointer truncate max-w-36"
                                            >
                                                {breadcrumb.label}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </nav>
                    )}

                    {/* MAIN RESOURCE TITLE */}
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-text font-serif">
                            {title ?? getResourceTitle(resourceName)}
                        </h1>
                        <span className="text-xs px-2 py-1 rounded-full bg-surface-hover text-text-muted font-medium border border-surface-border">
                            {totalCount} {totalCount === 1 ? 'record' : 'records'}
                        </span>
                    </div>

                    {description && (
                        <p className="text-xs text-text-muted max-w-2xl leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>

                {/* PRIMARY ACTION (E.G. ADD NEW / NEW DOCUMENT) */}
                {onAddItem && (
                    <div className="shrink-0">
                        <PrimaryButton
                            leadingIcon={addItemIcon}
                            onClick={handleAddClick}
                        >
                            {addItemLabel}
                        </PrimaryButton>
                    </div>
                )}
            </div>

            {/* ACTION TOOLBAR: SEARCH, SORT SELECT, COMBO FILTERS, VIEW SELECTOR, AND ARCHIVE TOGGLE */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-surface-border">
                {/* SEARCH FIELD: UNIFIED SHORT WIDTH */}
                <div className="w-full sm:w-64 shrink-0">
                    <SearchField
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onClear={handleSearchClear}
                    />
                </div>

                {/* CONTROLS: SORT SELECT, FILTERS, VIEW SWITCHER, AND ARCHIVE TOGGLE */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {sortOptions.length > 0 && (
                        <div className="w-52 min-w-48 shrink-0">
                            <SelectField
                                value={activeSortBy}
                                options={sortOptions}
                                onChange={handleSortChange}
                                leadingIcon={ArrowUpDown}
                                placeholder="Sort records..."
                                dropdownAlign="right"
                            />
                        </div>
                    )}

                    {filterOptions.length > 0 && (
                        <div className="w-52 min-w-48 shrink-0">
                            <ComboField
                                options={filterOptions}
                                value={selectedFilters}
                                onChange={handleFilterChange}
                                multiple={true}
                                leadingIcon={Filter}
                                placeholder="Filter records..."
                                dropdownAlign="right"
                            />
                        </div>
                    )}

                    <ViewSelection
                        value={currentView}
                        options={VIEW_OPTIONS}
                        onChange={handleViewChange}
                    />

                    {showArchiveToggle && (
                        <ToggleSelection
                            pressed={isArchived}
                            icon={Archive}
                            onChange={onToggleArchived}
                            title={isArchived ? 'Viewing Archived Records (Click to view active)' : 'View Archived Records'}
                        />
                    )}
                </div>
            </div>

            {/* MAIN CONTENT AREA: VIEW RENDERER */}
            {filteredData.length === 0 ? (
                <div className="py-16 text-center border border-surface-border rounded-lg bg-surface flex flex-col items-center justify-center gap-2">
                    <div className="p-3 rounded-full bg-surface-hover text-text-muted">
                        {renderItemIcon({}, resourceName)}
                    </div>
                    <span className="font-semibold text-sm text-text">No records found</span>
                    <p className="text-xs text-text-muted max-w-sm">
                        No matching entries found for "{searchQuery}". Try modifying your search or filter filters.
                    </p>
                    {searchQuery && (
                        <SecondaryButton
                            onClick={handleSearchClear}
                            className="mt-2"
                        >
                            Clear search
                        </SecondaryButton>
                    )}
                </div>
            ) : currentView === 'grid' ? (
                <BrowserGridView
                    data={filteredData}
                    resourceName={resourceName}
                    selectedId={selectedId}
                    onItemClick={handleItemInteraction}
                    onToggleActionMenu={handleToggleActionMenu}
                />
            ) : currentView === 'list' ? (
                <BrowserListView
                    data={filteredData}
                    resourceName={resourceName}
                    selectedId={selectedId}
                    onItemClick={handleItemInteraction}
                    onToggleActionMenu={handleToggleActionMenu}
                />
            ) : (
                <BrowserTableView
                    data={filteredData}
                    columns={columns}
                    resourceName={resourceName}
                    selectedId={selectedId}
                    onItemClick={handleItemInteraction}
                    onItemDoubleClick={handleItemInteraction}
                    onToggleActionMenu={handleToggleActionMenu}
                />
            )}

            {/* GLOBAL PORTAL-MOUNTED CONTEXTUAL ACTION MENU WITH SMART POSITIONING */}
            {activeActionMenu && (
                <ActionMenu
                    item={activeActionMenu.item}
                    resourceName={resourceName}
                    anchorRect={activeActionMenu.anchorRect}
                    onActionClick={handleActionClick}
                />
            )}
        </div>
    );
};

// 2. GRID VIEW RENDERER
const BrowserGridView = ({
    data,
    resourceName,
    selectedId,
    onItemClick,
    onToggleActionMenu,
}) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((item) => {
                const isSelected = selectedId === item.id;

                return (
                    <CardContainer
                        key={item.id}
                        onClick={() => onItemClick?.(item)}
                        className={`p-4 gap-3 justify-between transition-colors cursor-pointer group select-none min-w-0 ${isSelected
                            ? 'bg-accent-background border-accent'
                            : 'bg-surface border-surface-border hover:border-accent-border'
                            }`}
                    >
                        {/* CARD TOP ROW: ICON, FIXED-WIDTH TRUNCATED TITLE, AND BADGE */}
                        <div className="flex items-start justify-between gap-3 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                {resourceName === 'users' ? (
                                    <UserAvatar
                                        src={item.avatar_path}
                                        name={item.title ?? item.name}
                                        size="md"
                                        className="h-10 w-10 shrink-0 shadow-xs"
                                    />
                                ) : (
                                    <div
                                        className={`p-2 rounded-lg transition-colors shrink-0 ${isSelected
                                            ? 'bg-accent text-text-inverted'
                                            : 'bg-surface-hover text-accent group-hover:bg-accent-background'
                                            }`}
                                    >
                                        {renderItemIcon(item, resourceName)}
                                    </div>
                                )}
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span
                                        className={`font-semibold text-sm truncate block ${isSelected ? 'text-accent' : 'text-text'}`}
                                        title={item.title ?? item.name ?? item.subject}
                                    >
                                        {item.title ?? item.name ?? item.subject}
                                    </span>
                                </div>
                            </div>

                            <div className="shrink-0">
                                {renderItemBadge(item)}
                            </div>
                        </div>

                        {item.description && (
                            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                                {item.description}
                            </p>
                        )}

                        {/* CARD FOOTER: METADATA & TRIPLE DOT TRIGGER */}
                        <div className="flex items-center justify-between text-xs text-text-muted border-t border-surface-border pt-3">
                            <span className="truncate">{item.metadata ?? item.department ?? item.date}</span>
                            <button
                                type="button"
                                onClick={(event) => onToggleActionMenu(event, item)}
                                className="text-text-muted hover:text-text p-1 rounded hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
                                title="Item actions"
                                aria-label="Item actions"
                            >
                                <MoreVertical className={ICON_STYLE} />
                            </button>
                        </div>
                    </CardContainer>
                );
            })}
        </div>
    );
};

// 3. LIST VIEW RENDERER
const BrowserListView = ({
    data,
    resourceName,
    selectedId,
    onItemClick,
    onToggleActionMenu,
}) => {
    return (
        <div className="flex flex-col gap-2">
            {data.map((item) => {
                const isSelected = selectedId === item.id;

                return (
                    <div
                        key={item.id}
                        onClick={() => onItemClick?.(item)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer select-none gap-4 min-w-0 ${isSelected
                            ? 'bg-accent-background border-accent'
                            : 'bg-surface border-surface-border hover:bg-surface-hover'
                            }`}
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            {resourceName === 'users' ? (
                                <UserAvatar
                                    src={item.avatar_path}
                                    name={item.title ?? item.name}
                                    size="sm"
                                    className="h-9 w-9 shrink-0 shadow-xs"
                                />
                            ) : (
                                <div
                                    className={`p-2 rounded-md transition-colors shrink-0 ${isSelected
                                        ? 'bg-accent text-text-inverted'
                                        : 'bg-surface-hover text-accent'
                                        }`}
                                >
                                    {renderItemIcon(item, resourceName)}
                                </div>
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                                <span
                                    className={`font-semibold text-sm truncate block ${isSelected ? 'text-accent' : 'text-text'}`}
                                    title={item.title ?? item.name ?? item.subject}
                                >
                                    {item.title ?? item.name ?? item.subject}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-text-muted truncate">
                                    {item.department && <span>{item.department}</span>}
                                    {item.date && <span>· {item.date}</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            {renderItemBadge(item)}
                            <button
                                type="button"
                                onClick={(event) => onToggleActionMenu(event, item)}
                                className="text-text-muted hover:text-text p-1 rounded hover:bg-surface-hover transition-colors cursor-pointer"
                                title="Item actions"
                                aria-label="Item actions"
                            >
                                <MoreVertical className={ICON_STYLE} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// 4. TABLE VIEW RENDERER
const BrowserTableView = ({
    data,
    columns = [],
    resourceName,
    selectedId,
    onItemClick,
    onItemDoubleClick,
    onToggleActionMenu,
}) => {
    const effectiveColumns = columns.length > 0
        ? columns
        : [
            { key: 'title', label: 'Name' },
            { key: 'department', label: 'Department / Unit' },
            { key: 'status', label: 'Status' },
            { key: 'date', label: 'Date Modified' },
        ];

    return (
        <div className="w-full overflow-x-auto rounded-lg border border-surface-border bg-surface">
            <table className="w-max min-w-full text-left text-xs border-collapse">
                <thead>
                    <tr className="border-b border-surface-border bg-surface-hover font-semibold text-text-muted">
                        {effectiveColumns.map((column) => (
                            <th
                                key={column.key}
                                className="px-4 py-3 font-medium whitespace-nowrap"
                            >
                                {column.label}
                            </th>
                        ))}
                        <th className="px-4 py-3 text-right font-medium whitespace-nowrap w-12">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                    {data.map((item) => {
                        const isSelected = selectedId === item.id;

                        return (
                            <tr
                                key={item.id}
                                onClick={() => onItemClick?.(item)}
                                onDoubleClick={() => onItemDoubleClick?.(item)}
                                className={`cursor-pointer transition-colors select-none ${isSelected
                                    ? 'bg-accent-background text-text'
                                    : 'hover:bg-surface-hover text-text'
                                    }`}
                            >
                                {effectiveColumns.map((column) => (
                                    <td
                                        key={column.key}
                                        className="px-4 py-3 whitespace-nowrap"
                                    >
                                        {column.key === 'title' || column.key === 'name' || column.key === 'subject' ? (
                                            <div className="flex items-center gap-2.5 whitespace-nowrap">
                                                <div className="text-accent shrink-0">
                                                    {renderItemIcon(item, resourceName)}
                                                </div>
                                                <span
                                                    className={`font-semibold whitespace-nowrap ${isSelected ? 'text-accent' : 'text-text'}`}
                                                >
                                                    {item.title ?? item.name ?? item.subject}
                                                </span>
                                            </div>
                                        ) : column.key === 'classification' ? (
                                            <ClassificationBadge classification={item.classification} />
                                        ) : column.key === 'role' && item.role ? (
                                            <RoleBadge role={item.role} />
                                        ) : column.key === 'status' && item.status ? (
                                            <StatusBadge status={item.status} />
                                        ) : (
                                            <span className="text-text-muted whitespace-nowrap">
                                                {item[column.key] ?? '—'}
                                            </span>
                                        )}
                                    </td>
                                ))}
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={(event) => onToggleActionMenu(event, item)}
                                        className="text-text-muted hover:text-text p-1 rounded hover:bg-surface-hover transition-colors cursor-pointer"
                                        title="Row options"
                                        aria-label="Row options"
                                    >
                                        <MoreVertical className={ICON_STYLE} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// 5. PORTAL-MOUNTED CONTEXTUAL ACTION MENU WITH SMART POSITIONING
const ActionMenu = ({
    item,
    resourceName,
    anchorRect,
    onActionClick,
}) => {
    if (!item || !anchorRect) {
        return null;
    }

    const isFolder = item.isFolder;
    const isArchived = item.isArchived || item.status === DOCUMENT_SHARE_STATUSES.STASHED;

    const estimatedDropdownHeight = 220;
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;

    const shouldOpenUpwards = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow;

    const topPosition = shouldOpenUpwards
        ? Math.max(8, anchorRect.top - estimatedDropdownHeight - 4)
        : Math.min(window.innerHeight - estimatedDropdownHeight - 8, anchorRect.bottom + 4);

    const rightPosition = Math.max(8, window.innerWidth - anchorRect.right);

    const dynamicStyle = {
        position: 'fixed',
        top: `${topPosition}px`,
        right: `${rightPosition}px`,
        zIndex: 9999,
    };

    return createPortal(
        <DropdownContainer
            style={dynamicStyle}
            onClick={(event) => event.stopPropagation()}
            className="animate-toast-in shadow-2xl min-w-48 text-xs select-none border border-surface-border bg-surface pointer-events-auto"
        >
            {/* 1. DEPARTMENTS RESOURCE ACTIONS */}
            {resourceName === 'departments' && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Eye className={ICON_STYLE} />
                        <span>View Details</span>
                    </button>
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'edit', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Edit3 className={ICON_STYLE} />
                        <span>Edit Department</span>
                    </button>
                    <div className="h-px bg-surface-border my-1" />
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'delete', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Trash2 className={ICON_STYLE} />
                        <span>Delete Department</span>
                    </button>
                </>
            )}

            {/* 2. USERS RESOURCE ACTIONS */}
            {resourceName === 'users' && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <User className={ICON_STYLE} />
                        <span>View Profile</span>
                    </button>
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'edit', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Edit3 className={ICON_STYLE} />
                        <span>Edit User & Role</span>
                    </button>
                    <div className="h-px bg-surface-border my-1" />
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'delete', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Trash2 className={ICON_STYLE} />
                        <span>Remove User</span>
                    </button>
                </>
            )}

            {/* 3. DOCUMENT REQUESTS RESOURCE ACTIONS */}
            {resourceName === 'document_requests' && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <MessageSquare className={ICON_STYLE} />
                        <span>View Thread & Messages</span>
                    </button>
                    {item.status === 'OPEN' && (
                        <>
                            <button
                                type="button"
                                onClick={(event) => onActionClick(event, 'resolve', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <CheckCircle2 className={ICON_STYLE} />
                                <span>Resolve Request</span>
                            </button>
                            <button
                                type="button"
                                onClick={(event) => onActionClick(event, 'reject', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <XCircle className={ICON_STYLE} />
                                <span>Reject Request</span>
                            </button>
                        </>
                    )}
                    <div className="h-px bg-surface-border my-1" />
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'delete', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Trash2 className={ICON_STYLE} />
                        <span>Delete Request</span>
                    </button>
                </>
            )}

            {/* 4. COORDINATOR REQUESTS RESOURCE ACTIONS */}
            {resourceName === 'coordinator_requests' && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Eye className={ICON_STYLE} />
                        <span>Review Payload Details</span>
                    </button>
                    {item.status === 'PENDING' && (
                        <>
                            <button
                                type="button"
                                onClick={(event) => onActionClick(event, 'approve', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <CheckCircle2 className={ICON_STYLE} />
                                <span>Approve Request</span>
                            </button>
                            <button
                                type="button"
                                onClick={(event) => onActionClick(event, 'reject', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <XCircle className={ICON_STYLE} />
                                <span>Reject Request</span>
                            </button>
                        </>
                    )}
                    <div className="h-px bg-surface-border my-1" />
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'delete', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Trash2 className={ICON_STYLE} />
                        <span>Delete Request</span>
                    </button>
                </>
            )}

            {/* 5. DOCUMENTS & ARCHIVES DEFAULT ACTIONS */}
            {(resourceName === 'documents' || resourceName === 'archives' || resourceName === 'my_requests') && (
                <>
                    <button
                        type="button"
                        onClick={(event) => onActionClick(event, 'open', item)}
                        className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                    >
                        <Eye className={ICON_STYLE} />
                        <span>{isFolder ? 'Open Folder' : 'View Details'}</span>
                    </button>

                    {!isFolder && resourceName === 'documents' && (
                        <button
                            type="button"
                            onClick={(event) => onActionClick(event, 'share', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <Share2 className={ICON_STYLE} />
                            <span>Share / Publish</span>
                        </button>
                    )}

                    {!isFolder && item.status === DOCUMENT_SHARE_STATUSES.PENDING_APPROVAL && (
                        <button
                            type="button"
                            onClick={(event) => onActionClick(event, 'approve', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-accent hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <CheckCircle2 className={ICON_STYLE} />
                            <span>Approve Document</span>
                        </button>
                    )}

                    {!isFolder && resourceName === 'documents' && (
                        <button
                            type="button"
                            onClick={(event) => onActionClick(event, 'comment', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <MessageSquare className={ICON_STYLE} />
                            <span>Comments & Notes</span>
                        </button>
                    )}

                    <div className="h-px bg-surface-border my-1" />

                    {isArchived ? (
                        <>
                            <button
                                type="button"
                                onClick={(event) => onActionClick(event, 'restore', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Archive className={ICON_STYLE} />
                                <span>Restore to Active</span>
                            </button>

                            <button
                                type="button"
                                onClick={(event) => onActionClick(event, 'delete', item)}
                                className="flex items-center gap-2 px-3 py-2 rounded text-error hover:bg-error-background transition-colors cursor-pointer w-full text-left font-medium"
                            >
                                <Trash2 className={ICON_STYLE} />
                                <span>Permanent Delete</span>
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={(event) => onActionClick(event, 'archive', item)}
                            className="flex items-center gap-2 px-3 py-2 rounded text-text hover:bg-surface-hover transition-colors cursor-pointer w-full text-left font-medium"
                        >
                            <Archive className={ICON_STYLE} />
                            <span>Stash & Archive</span>
                        </button>
                    )}
                </>
            )}
        </DropdownContainer>,
        document.body
    );
};

export {
    Browser,
    BrowserGridView,
    BrowserListView,
    BrowserTableView,
    ActionMenu,
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

    if (resourceName === 'users' || item.university_id) {
        return (
            <UserAvatar
                src={item.avatar_path}
                name={item.title ?? item.name}
                size="xs"
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
}

function renderItemBadge(item) {
    if (item.classification && item.classification !== '—') {
        return <ClassificationBadge classification={item.classification} />;
    }

    if (item.role) {
        return <RoleBadge role={item.role} />;
    }

    if (item.status) {
        return <StatusBadge status={item.status} />;
    }

    if (item.badge) {
        return <Badge variant="neutral" label={item.badge} />;
    }

    return null;
}
