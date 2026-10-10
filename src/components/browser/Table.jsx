import { MoreVertical } from 'lucide-react';
import { Avatar } from '../Avatar';
import { Checkbox } from '../Checkbox';
import {
    ICON_STYLE,
    renderItemIcon,
    renderItemBadge,
    getSpecificMimeLabel,
} from './common';


// --- COMPONENTS ---
const Table = ({
    data = [],
    columns = [],
    resourceName,
    selectedId,
    selectedIds = new Set(),
    onItemClick,
    onItemDoubleClick,
    onToggleActionMenu,
    onToggleSelect,
    onToggleSelectAll,
    onContextMenu,
    className,
    ...props
}) => {
    // DERIVED VALUES
    const effectiveColumns = columns.length > 0
        ? columns
        : [
            { key: 'title', label: 'Name' },
            { key: 'department', label: 'Department / Unit' },
            { key: 'status', label: 'Status' },
            { key: 'date', label: 'Date Modified' },
        ];

    // Keep all columns visible across all viewports
    const getColumnVisibilityClass = () => '';

    const isAllSelected = data.length > 0 && data.every((item) => selectedIds.has(item.id));
    const isSomeSelected = data.some((item) => selectedIds.has(item.id)) && !isAllSelected;

    // RENDER
    return (
        <div className={`w-full overflow-x-auto overflow-y-auto max-h-[485px] rounded-xl border border-surface-border bg-surface shadow-2xs ${className ?? ''}`.trim()} {...props}>
            <table className="w-max min-w-full text-left text-xs sm:text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-30 bg-surface shadow-2xs">
                    <tr className="font-semibold text-xs sm:text-sm text-text select-none h-10 sm:h-11">
                        <th className="sticky left-0 top-0 z-40 w-[44px] min-w-[44px] max-w-[44px] px-3 py-2 sm:py-2.5 text-center align-middle bg-surface border-b border-surface-border">
                            <Checkbox
                                checked={isAllSelected}
                                indeterminate={isSomeSelected}
                                onChange={() => onToggleSelectAll?.()}
                                title={isAllSelected ? 'Deselect all' : 'Select all'}
                                aria-label="Select all"
                            />
                        </th>
                        {effectiveColumns.map((column, colIndex) => (
                            <th
                                key={column.key}
                                className={`px-3.5 py-2 sm:py-2.5 font-semibold whitespace-nowrap align-middle bg-surface border-b border-surface-border ${
                                    colIndex === 0
                                        ? 'sticky left-[44px] top-0 z-40 border-r border-surface-border w-[190px] sm:w-[230px] md:w-[260px] min-w-[190px] sm:min-w-[230px] md:min-w-[260px] max-w-[260px]'
                                        : ''
                                }`}
                            >
                                {column.label}
                            </th>
                        ))}
                        <th className="px-3.5 py-2 sm:py-2.5 text-right font-semibold whitespace-nowrap align-middle w-12 bg-surface border-b border-surface-border">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item) => {
                        const isChecked = selectedIds.has(item.id);
                        const isSelected = selectedId === item.id || isChecked;
                        const stickyCellBg = isChecked || isSelected
                            ? 'bg-accent-background'
                            : 'bg-surface group-hover:bg-surface-hover';

                        return (
                            <tr
                                key={item.id}
                                data-record-id={item.id}
                                data-selected={isSelected ? 'true' : 'false'}
                                onClick={() => {
                                    if (selectedIds.size > 0) {
                                        onToggleSelect?.(item);
                                    } else {
                                        onItemClick?.(item);
                                    }
                                }}
                                onDoubleClick={() => {
                                    if (selectedIds.size === 0) {
                                        onItemDoubleClick?.(item);
                                    }
                                }}
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    onContextMenu?.(event, item);
                                }}
                                className={`group cursor-pointer transition-colors duration-150 select-none h-10 sm:h-11 ${
                                    isChecked || isSelected
                                        ? 'bg-accent-background text-text font-medium'
                                        : 'hover:bg-surface-hover text-text'
                                }`}
                            >
                                <td
                                    className={`sticky left-0 z-20 w-[44px] min-w-[44px] max-w-[44px] px-3 py-2 sm:py-2.5 text-center align-middle border-b border-surface-border transition-colors ${stickyCellBg}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Checkbox
                                        checked={isChecked}
                                        onChange={() => onToggleSelect?.(item)}
                                        aria-label={`Select ${item.title ?? item.name ?? 'item'}`}
                                    />
                                </td>
                                {effectiveColumns.map((column, colIndex) => (
                                    <td
                                        key={column.key}
                                        className={`px-3.5 py-2 sm:py-2.5 whitespace-nowrap text-xs sm:text-[13px] align-middle border-b border-surface-border ${
                                            colIndex === 0
                                                ? `sticky left-[44px] z-20 border-r border-surface-border w-[190px] sm:w-[230px] md:w-[260px] min-w-[190px] sm:min-w-[230px] md:min-w-[260px] max-w-[260px] transition-colors ${stickyCellBg}`
                                                : ''
                                        }`}
                                    >
                                        {column.key === 'title' || column.key === 'name' || column.key === 'subject' ? (
                                            <div className="flex items-center gap-2.5 whitespace-nowrap min-w-0">
                                                {resourceName === 'users' || item.universityId ? (
                                                    <Avatar
                                                        src={item.avatarPath}
                                                        user={item.user ?? item}
                                                        alt={item.title ?? item.name}
                                                        size="small"
                                                        className="h-6.5 w-6.5 rounded-full aspect-square shrink-0 ring-1 ring-surface-border shadow-2xs"
                                                    />
                                                ) : (
                                                    <div className={`h-6.5 w-6.5 rounded-md transition-colors shrink-0 flex items-center justify-center p-0.5 [&>svg]:h-4 [&>svg]:w-4 ${
                                                        isSelected ? 'bg-accent/20 text-accent' : 'bg-surface-hover/80 text-accent group-hover:bg-accent/10'
                                                    }`}>
                                                        {renderItemIcon(item, resourceName)}
                                                    </div>
                                                )}
                                                <div className="flex flex-col min-w-0 justify-center">
                                                    <span
                                                        className={`font-normal text-xs sm:text-[13px] whitespace-nowrap truncate max-w-[130px] sm:max-w-[170px] md:max-w-[200px] ${isSelected ? 'text-accent font-medium' : 'text-text'}`}
                                                        title={item.title ?? item.name ?? item.subject}
                                                    >
                                                        {item.title ?? item.name ?? item.subject}
                                                    </span>
                                                    {item.subtitle && (
                                                        <span className="text-[10px] text-text-muted font-normal truncate max-w-[130px] sm:max-w-[170px] md:max-w-[200px] leading-tight">
                                                            {item.isFolder || item.subtitle === 'DIR'
                                                                ? 'Directory'
                                                                : (item.subtitle === 'Document'
                                                                    ? getSpecificMimeLabel(item.mimeType, item.fileName || item.path || item.name || item.title)
                                                                    : item.subtitle)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (column.key === 'requester' || column.key === 'requesterName') ? (
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <Avatar
                                                    src={item.requesterAvatar ?? item.requesterUser?.avatarPath ?? item.avatarPath}
                                                    user={item.requesterUser ?? item.requester}
                                                    alt={item.requesterName ?? (typeof item.requester === 'string' ? item.requester : 'Requester')}
                                                    size="small"
                                                    className="h-5 w-5 rounded-full aspect-square shrink-0 ring-1 ring-surface-border"
                                                />
                                                <span className="font-normal text-text text-xs sm:text-[13px] whitespace-nowrap">
                                                    {item.requesterName ?? (typeof item.requester === 'string' ? item.requester : '—')}
                                                </span>
                                            </div>
                                        ) : column.key === 'classification' || column.key === 'role' || column.key === 'status' ? (
                                            renderItemBadge(item, column.key)
                                        ) : (
                                            <span className="text-text-muted whitespace-nowrap font-normal text-xs sm:text-[13px]">
                                                {item[column.key] ?? '—'}
                                            </span>
                                        )}
                                    </td>
                                ))}
                                <td className="px-3.5 py-2 sm:py-2.5 text-right whitespace-nowrap align-middle border-b border-surface-border/80">
                                    <button
                                        type="button"
                                        onClick={(event) => onToggleActionMenu(event, item)}
                                        className="text-text-muted hover:text-text p-1 rounded-md hover:bg-surface-hover transition-colors cursor-pointer inline-flex items-center justify-center"
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


// --- EXPORTS ---
export { Table };

