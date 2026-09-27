// --- IMPORTS ---
import { MoreVertical } from 'lucide-react';
import { Avatar } from '../Avatar';
import {
    ICON_STYLE,
    renderItemIcon,
    renderItemBadge,
} from './common';


// --- COMPONENTS ---
const Table = ({
    data = [],
    columns = [],
    resourceName,
    selectedId,
    onItemClick,
    onItemDoubleClick,
    onToggleActionMenu,
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

    // HELPER: Responsive column hiding on small mobile screens
    const getColumnVisibilityClass = (key) => {
        if (key === 'size' || key === 'version') return 'hidden sm:table-cell';
        if (key === 'date') return 'hidden md:table-cell';
        return '';
    };

    // RENDER
    return (
        <div className={`w-full overflow-x-auto overflow-y-auto max-h-[485px] rounded-xl border border-surface-border bg-surface shadow-2xs ${className ?? ''}`.trim()} {...props}>
            <table className="w-max min-w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-surface shadow-2xs">
                    <tr className="border-b border-surface-border bg-surface-hover/70 font-semibold text-xs sm:text-sm text-text select-none h-10 sm:h-11">
                        {effectiveColumns.map((column) => (
                            <th
                                key={column.key}
                                className={`px-3.5 py-2 sm:py-2.5 font-semibold whitespace-nowrap align-middle ${getColumnVisibilityClass(column.key)}`}
                            >
                                {column.label}
                            </th>
                        ))}
                        <th className="px-3.5 py-2 sm:py-2.5 text-right font-semibold whitespace-nowrap align-middle w-12">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/80">
                    {data.map((item) => {
                        const isSelected = selectedId === item.id;

                        return (
                            <tr
                                key={item.id}
                                data-record-id={item.id}
                                data-selected={isSelected ? 'true' : 'false'}
                                onClick={() => onItemClick?.(item)}
                                onDoubleClick={() => onItemDoubleClick?.(item)}
                                className={`group cursor-pointer transition-colors duration-150 select-none h-10 sm:h-11 ${isSelected
                                    ? 'bg-accent/10 text-text font-medium'
                                    : 'hover:bg-surface-hover/60 text-text'
                                }`}
                            >
                                {effectiveColumns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={`px-3.5 py-2 sm:py-2.5 whitespace-nowrap text-xs sm:text-[13px] align-middle ${getColumnVisibilityClass(column.key)}`}
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
                                                        className={`font-normal text-xs sm:text-[13px] whitespace-nowrap truncate max-w-xs sm:max-w-md ${isSelected ? 'text-accent font-medium' : 'text-text'}`}
                                                        title={item.title ?? item.name ?? item.subject}
                                                    >
                                                        {item.title ?? item.name ?? item.subject}
                                                    </span>
                                                    {item.subtitle && (
                                                        <span className="text-[10px] text-text-muted font-normal truncate max-w-xs leading-tight">
                                                            {item.subtitle}
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
                                <td className="px-3.5 py-2 sm:py-2.5 text-right whitespace-nowrap align-middle">
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

