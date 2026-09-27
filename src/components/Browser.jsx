// --- IMPORTS ---
import { useEffect, useMemo, useRef, useState } from 'react';
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
    Home,
    LayoutGrid,
    List as ListIcon,
    Plus,
    RotateCcw,
    Table as TableIcon,
    X,
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
    { value: 'name-asc', label: 'Name (A to Z)', icon: ArrowDownAZ },
    { value: 'name-desc', label: 'Name (Z to A)', icon: ArrowUpAZ },
    { value: 'date-desc', label: 'Recently Added', icon: Clock },
    { value: 'date-asc', label: 'Oldest Added', icon: Clock },
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
    const [internalSortBy, setInternalSortBy] = useState(sortBy ?? 'name-asc');
    const [currentView, setCurrentView] = useState(initialView);
    const [internalSelectedId, setInternalSelectedId] = useState(null);
    const [activeActionMenu, setActiveActionMenu] = useState(null);
    const [toolbarWidth, setToolbarWidth] = useState(null);
    const toolbarRef = useRef(null);

    // MEASURE TOOLBAR CONTAINER WIDTH DYNAMICALLY
    useEffect(() => {
        if (!toolbarRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect) {
                    setToolbarWidth(entry.contentRect.width);
                }
            }
        });
        observer.observe(toolbarRef.current);
        return () => observer.disconnect();
    }, []);

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
                            item.departmentCode === filterValue ||
                            item.departmentId === filterValue ||
                            (typeof item.department === 'string' && item.department.toLowerCase().includes(String(filterValue).toLowerCase())) ||
                            item.tags?.includes?.(filterValue)
                        );
                    });
                }
            );

            return matchesSearch && matchesCategoryFilters;
        });

        return filtered.sort((itemA, itemB) => {
            // 1. SMART DOMAIN-SPECIFIC PRIMARY SORTS:
            // For Documents and Archives: Folders ALWAYS appear first at the top
            const hasFolderItems = resourceName === 'documents' || resourceName === 'archives' || data.some((d) => d?.isFolder);
            if (hasFolderItems && Boolean(itemA.isFolder) !== Boolean(itemB.isFolder)) {
                return itemA.isFolder ? -1 : 1;
            }

            // For Document Requests: Open / Actionable status comes first
            if (resourceName === 'requests' || resourceName === 'request_document') {
                const getStatusWeight = (status) => {
                    const s = String(status || '').toUpperCase();
                    if (s === 'OPEN' || s === 'PENDING') return 1;
                    if (s === 'PENDING_APPROVAL' || s === 'PENDING_REVIEW') return 2;
                    if (s === 'RESOLVED' || s === 'APPROVED') return 3;
                    if (s === 'REJECTED') return 4;
                    return 5;
                };
                const weightA = getStatusWeight(itemA.status);
                const weightB = getStatusWeight(itemB.status);
                if (weightA !== weightB && activeSortBy.startsWith('status-priority')) {
                    return weightA - weightB;
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
        <div className={`flex flex-col gap-3 sm:gap-4 text-text ${className ?? ''}`.trim()} {...props}>
            {/* HEADER AREA: TITLE, DESCRIPTION, BREADCRUMBS, AND PRIMARY ACTION */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border/80 pb-3">
                <div className="flex flex-col gap-1.5 min-w-0">
                    {breadcrumbs && breadcrumbs.length > 0 && (
                        <nav className="flex items-center gap-1 text-xs text-text-muted select-none flex-wrap mb-0.5">
                            {breadcrumbs.map((breadcrumb, index) => {
                                const isLast = index === breadcrumbs.length - 1;
                                const isFirst = index === 0;

                                return (
                                    <div key={breadcrumb.id ?? index} className="inline-flex items-center gap-1">
                                        {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-text-muted/50" />}
                                        {isLast ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 text-accent font-semibold text-xs border border-accent/20 truncate max-w-56 shadow-2xs">
                                                {isFirst && <Home className="h-3 w-3 shrink-0 text-accent" />}
                                                <span className="truncate">{breadcrumb.label}</span>
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onBreadcrumbClick?.(breadcrumb, index)}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover/80 transition-colors cursor-pointer text-xs truncate max-w-40 font-medium"
                                            >
                                                {isFirst && <Home className="h-3 w-3 shrink-0 text-text-muted" />}
                                                <span className="truncate">{breadcrumb.label}</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </nav>
                    )}

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-base sm:text-lg font-bold text-text font-serif tracking-tight truncate">
                            {title ?? getResourceTitle(resourceName)}
                        </h1>
                        <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-surface-hover/90 text-text-muted font-medium border border-surface-border shrink-0 shadow-2xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                            <span>{totalCount} {totalCount === 1 ? 'record' : 'records'}</span>
                        </span>
                    </div>

                    {description && (
                        <p className="text-xs text-text-muted max-w-2xl leading-relaxed line-clamp-2">
                            {description}
                        </p>
                    )}
                </div>

                {onAddItem && (
                    <div className="shrink-0 w-full sm:w-48">
                        <Button
                            variant="primary"
                            size="sm"
                            leadingIcon={addItemIcon}
                            onClick={handleAddClick}
                            className="w-full sm:w-48 min-w-[12rem] whitespace-nowrap justify-center shadow-2xs text-center"
                        >
                            {addItemLabel}
                        </Button>
                    </div>
                )}
            </div>

            {/* ACTION TOOLBAR: SEARCH, SORT SELECT, COMBO FILTERS, VIEW SELECTOR, AND ARCHIVE TOGGLE */}
            <div ref={toolbarRef} className="relative z-30 flex flex-col gap-2 bg-surface/90 backdrop-blur-md p-2 sm:p-2.5 rounded-xl border border-surface-border shadow-2xs">
                {(() => {
                    const hasSort = sortOptions && sortOptions.length > 0;
                    const hasFilter = filterOptions && filterOptions.length > 0;

                    let layoutTier = 'full';
                    if (toolbarWidth !== null) {
                        if (toolbarWidth < 420) {
                            layoutTier = 'mobile';
                        } else if (toolbarWidth < 580) {
                            layoutTier = 'quarter';
                        } else if (toolbarWidth < 840) {
                            layoutTier = 'half';
                        } else {
                            layoutTier = 'full';
                        }
                    }

                    const searchNode = (
                        <SearchField
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onClear={handleSearchClear}
                        />
                    );

                    const sortNode = hasSort ? (
                        <SelectField
                            value={activeSortBy}
                            options={sortOptions}
                            onChange={handleSortChange}
                            leadingIcon={ArrowUpDown}
                            placeholder="Sort records..."
                            dropdownAlign="right"
                        />
                    ) : null;

                    const filterNode = hasFilter ? (
                        <ComboField
                            options={filterOptions}
                            value={selectedFilters}
                            onChange={handleFilterChange}
                            isMultiple={true}
                            leadingIcon={Filter}
                            placeholder="Filter records..."
                            dropdownAlign="right"
                        />
                    ) : null;

                    const viewControlsNode = (
                        <div className="flex items-center gap-1.5 shrink-0">
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
                    );

                    // Case A: Both sort and filter are present
                    if (hasSort && hasFilter) {
                        if (layoutTier === 'full') {
                            return (
                                <div className="flex items-center justify-between gap-2.5 w-full">
                                    <div className="w-64 sm:w-72 md:w-80 max-w-sm shrink-0">
                                        {searchNode}
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
                                        <div className="w-44 sm:w-48 shrink-0">{sortNode}</div>
                                        <div className="w-44 sm:w-48 shrink-0">{filterNode}</div>
                                        {viewControlsNode}
                                    </div>
                                </div>
                            );
                        }

                        if (layoutTier === 'half') {
                            return (
                                <div className="flex flex-col gap-2 w-full">
                                    <div className="flex items-center gap-2 sm:gap-2.5 w-full">
                                        <div className="flex-1 min-w-0">{searchNode}</div>
                                        <div className="flex-1 min-w-0">{sortNode}</div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-2.5 w-full">
                                        <div className="flex-1 min-w-0">{filterNode}</div>
                                        <div className="shrink-0">{viewControlsNode}</div>
                                    </div>
                                </div>
                            );
                        }

                        if (layoutTier === 'quarter') {
                            return (
                                <div className="flex flex-col gap-2 w-full">
                                    <div className="w-full">{searchNode}</div>
                                    <div className="flex items-center gap-2 sm:gap-2.5 w-full">
                                        <div className="flex-1 min-w-0">{sortNode}</div>
                                        <div className="flex-1 min-w-0">{filterNode}</div>
                                    </div>
                                    <div className="shrink-0">{viewControlsNode}</div>
                                </div>
                            );
                        }

                        // Mobile tier
                        return (
                            <div className="flex flex-col gap-2 w-full">
                                <div className="w-full">{searchNode}</div>
                                <div className="w-full">{sortNode}</div>
                                <div className="w-full">{filterNode}</div>
                                <div className="shrink-0">{viewControlsNode}</div>
                            </div>
                        );
                    }

                    // Case B: Only one of sort or filter is present (e.g. departments)
                    const singleFilterNode = sortNode || filterNode;
                    if (singleFilterNode) {
                        if (layoutTier === 'full') {
                            return (
                                <div className="flex items-center justify-between gap-2.5 w-full">
                                    <div className="w-64 sm:w-72 md:w-80 max-w-sm shrink-0">
                                        {searchNode}
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
                                        <div className="w-44 sm:w-48 shrink-0">{singleFilterNode}</div>
                                        {viewControlsNode}
                                    </div>
                                </div>
                            );
                        }

                        if (layoutTier === 'half') {
                            return (
                                <div className="flex flex-col gap-2 w-full">
                                    <div className="flex items-center gap-2 sm:gap-2.5 w-full">
                                        <div className="flex-1 min-w-0">{searchNode}</div>
                                        <div className="flex-1 min-w-0">{singleFilterNode}</div>
                                    </div>
                                    <div className="shrink-0">{viewControlsNode}</div>
                                </div>
                            );
                        }

                        if (layoutTier === 'quarter') {
                            return (
                                <div className="flex flex-col gap-2 w-full">
                                    <div className="w-full">{searchNode}</div>
                                    <div className="flex items-center gap-2 sm:gap-2.5 w-full">
                                        <div className="flex-1 min-w-0">{singleFilterNode}</div>
                                        <div className="shrink-0">{viewControlsNode}</div>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div className="flex flex-col gap-2 w-full">
                                <div className="w-full">{searchNode}</div>
                                <div className="w-full">{singleFilterNode}</div>
                                <div className="shrink-0">{viewControlsNode}</div>
                            </div>
                        );
                    }

                    // Case C: Neither sort nor filter is present
                    if (layoutTier === 'full' || layoutTier === 'half') {
                        return (
                            <div className="flex items-center justify-between gap-2.5 w-full">
                                <div className="flex-1 max-w-md">
                                    {searchNode}
                                </div>
                                <div className="shrink-0 ml-auto">
                                    {viewControlsNode}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="w-full">{searchNode}</div>
                            <div className="shrink-0">{viewControlsNode}</div>
                        </div>
                    );
                })()}

                {/* ACTIVE FILTERS & SEARCH CHIPS STRIP */}
                {(selectedFilters.length > 0 || Boolean(searchQuery)) && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-surface-border/60 text-xs">
                        <span className="text-[11px] font-semibold text-text-muted">Filtered by:</span>
                        {searchQuery && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-hover border border-surface-border text-[11px] text-text">
                                <span>"{searchQuery}"</span>
                                <button type="button" onClick={handleSearchClear} className="hover:text-error cursor-pointer">
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}
                        {selectedFilters.map((filt) => (
                            <span key={filt} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 border border-accent/25 text-[11px] text-accent font-medium">
                                <span>{filt}</span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedFilters((prev) => prev.filter((f) => f !== filt))}
                                    className="hover:text-error cursor-pointer"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedFilters([]);
                            }}
                            className="text-[11px] text-text-muted hover:text-text hover:underline ml-1 cursor-pointer font-medium"
                        >
                            Reset all
                        </button>
                    </div>
                )}
            </div>

            {/* MAIN CONTENT AREA: VIEW RENDERER */}
            {filteredData.length === 0 ? (
                <div className="relative z-0 py-16 sm:py-20 px-4 text-center border border-dashed border-surface-border rounded-2xl bg-surface/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                    <div className="p-4 rounded-2xl bg-surface-hover/80 text-accent border border-surface-border/60 shadow-2xs">
                        {renderItemIcon({}, resourceName)}
                    </div>
                    <div className="flex flex-col items-center gap-1 max-w-sm">
                        <span className="font-bold text-sm sm:text-base text-text">
                            {searchQuery || selectedFilters.length > 0 ? 'No matching records found' : `No ${resourceName.replace(/_/g, ' ')} available`}
                        </span>
                        <p className="text-xs text-text-muted leading-relaxed">
                            {searchQuery || selectedFilters.length > 0
                                ? `No entries match your search criteria "${searchQuery || 'selected filters'}". Try clearing active filters.`
                                : `Get started by creating your first entry or refreshing the repository.`}
                        </p>
                    </div>
                    {(searchQuery || selectedFilters.length > 0) && (
                        <Button
                            variant="secondary"
                            size="sm"
                            leadingIcon={RotateCcw}
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedFilters([]);
                            }}
                            className="mt-1 shadow-2xs"
                        >
                            Clear filters & search
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
