// --- IMPORTS ---
import { MoreVertical } from 'lucide-react';
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

    // RENDER
    return (
        <div className={`w-full overflow-x-auto rounded-lg border border-surface-border bg-surface ${className ?? ''}`.trim()} {...props}>
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
                                            <div className="flex items-center gap-3 whitespace-nowrap">
                                                <div className="text-accent shrink-0">
                                                    {renderItemIcon(item, resourceName)}
                                                </div>
                                                <span
                                                    className={`font-semibold whitespace-nowrap ${isSelected ? 'text-accent' : 'text-text'}`}
                                                >
                                                    {item.title ?? item.name ?? item.subject}
                                                </span>
                                            </div>
                                        ) : column.key === 'classification' || column.key === 'role' || column.key === 'status' ? (
                                            renderItemBadge(item, column.key)
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


// --- EXPORTS ---
export { Table };
