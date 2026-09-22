// --- IMPORTS ---
import { useEffect, useMemo, useState } from 'react';
import {
    Archive,
    ArrowDownAZ,
    ArrowUpAZ,
    ArrowUpDown,
    ChevronRight,
    Clock,
    Filter,
    Folder,
    HardDrive,
    History,
    LayoutGrid,
    List as ListIcon,
    Plus,
    Table as TableIcon,
} from 'lucide-react';
import { useDoubleClick } from '../hooks';
import { Button } from './Button';
import { ComboField, SearchField, SelectField } from './Fields';
import { ToggleSelection, ViewSelection } from './Selections';
import { Table } from './browser/Table';
import { List } from './browser/List';
import { Grid } from './browser/Grid';
import { Menu } from './browser/Menu';
import {
    ICON_STYLE,
    getResourceTitle,
    renderItemIcon,
} from './browser/common';


// --- CONFIGURATIONS ---
const DEFAULT_SORT_OPTIONS = [
    { value: 'date-desc', label: 'Recently Modified', icon: Clock },
    { value: 'date-asc', label: 'Oldest Modified', icon: History },
    { value: 'name-asc', label: 'Name (A to Z)', icon: ArrowDownAZ },
    { value: 'name-desc', label: 'Name (Z to A)', icon: ArrowUpAZ },
    { value: 'size-desc', label: 'Size (Largest)', icon: HardDrive },
    { value: 'type-asc', label: 'Folders First', icon: Folder },
];

const VIEW_OPTIONS = [
    { value: 'table', label: 'Table View', title: 'Table View', icon: TableIcon },
    { value: 'list', label: 'List View', title: 'List View', icon: ListIcon },
    { value: 'grid', label: 'Grid View', title: 'Grid View', icon: LayoutGrid },
];


// --- COMPONENTS ---
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

    // HOOKS
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

    const selectedId = selectedItem?.id ?? internalSelectedId;

    useEffect(() => {
        if (!selectedId) return;
        const timer = setTimeout(() => {
            const element = document.querySelector(`[data-record-id="${selectedId}"]`);
            if (element && typeof element.scrollIntoView === 'function') {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [selectedId]);

    const handleItemInteraction = useDoubleClick({
        onClick: (item) => {
            const activeSelectedId = selectedItem?.id ?? internalSelectedId;
            if (activeSelectedId === item.id) {
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
    const activeSortBy = sortBy !== undefined ? sortBy : internalSortBy;

    const filteredData = useMemo(() => {
        const filtered = data.filter((item) => {
            const matchesSearch = searchQuery.trim() === '' || [
                item.title,
                item.subtitle,
                item.description,
                item.summary,
                item.department,
                item.classification,
                item.status,
                item.category,
                item.name,
                item.code,
                item.email,
                item.role,
                item.firstName,
                item.lastName,
                item.universityId,
                item.subject,
                item.action,
            ].some((field) => {
                return typeof field === 'string' && field.toLowerCase().includes(searchQuery.toLowerCase());
            });

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
                const timeA = new Date(itemA.updatedAt ?? itemA.createdAt ?? itemA.date ?? 0).getTime() || 0;
                const timeB = new Date(itemB.updatedAt ?? itemB.createdAt ?? itemB.date ?? 0).getTime() || 0;
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

            const timeA = new Date(itemA.updatedAt ?? itemA.createdAt ?? itemA.date ?? 0).getTime() || 0;
            const timeB = new Date(itemB.updatedAt ?? itemB.createdAt ?? itemB.date ?? 0).getTime() || 0;
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
                <div className="flex flex-col gap-2">
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

                {onAddItem && (
                    <div className="shrink-0">
                        <Button
                            variant="primary"
                            leadingIcon={addItemIcon}
                            onClick={handleAddClick}
                        >
                            {addItemLabel}
                        </Button>
                    </div>
                )}
            </div>

            {/* ACTION TOOLBAR: SEARCH, SORT SELECT, COMBO FILTERS, VIEW SELECTOR, AND ARCHIVE TOGGLE */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-surface-border">
                <div className="w-full sm:w-64 shrink-0">
                    <SearchField
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onClear={handleSearchClear}
                    />
                </div>

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
                                isMultiple={true}
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
                            isPressed={isArchived}
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
                        <Button
                            variant="secondary"
                            onClick={handleSearchClear}
                            className="mt-2"
                        >
                            Clear search
                        </Button>
                    )}
                </div>
            ) : currentView === 'grid' ? (
                <Grid
                    data={filteredData}
                    resourceName={resourceName}
                    selectedId={selectedId}
                    onItemClick={handleItemInteraction}
                    onToggleActionMenu={handleToggleActionMenu}
                />
            ) : currentView === 'list' ? (
                <List
                    data={filteredData}
                    resourceName={resourceName}
                    selectedId={selectedId}
                    onItemClick={handleItemInteraction}
                    onToggleActionMenu={handleToggleActionMenu}
                />
            ) : (
                <Table
                    data={filteredData}
                    columns={columns}
                    resourceName={resourceName}
                    selectedId={selectedId}
                    onItemClick={handleItemInteraction}
                    onItemDoubleClick={handleItemInteraction}
                    onToggleActionMenu={handleToggleActionMenu}
                />
            )}

            {/* GLOBAL PORTAL-MOUNTED CONTEXTUAL ACTION MENU */}
            {activeActionMenu && (
                <Menu
                    item={activeActionMenu.item}
                    resourceName={resourceName}
                    anchorRect={activeActionMenu.anchorRect}
                    onActionClick={handleActionClick}
                />
            )}
        </div>
    );
};


// --- EXPORTS ---
export {
    Browser,
    Table as BrowserTableView,
    List as BrowserListView,
    Grid as BrowserGridView,
    Menu as ActionMenu,
    Table,
    List,
    Grid,
    Menu,
};
export default Browser;
