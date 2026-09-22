// --- IMPORTS ---
import { MoreVertical } from 'lucide-react';
import { Avatar } from '../Avatar';
import {
    ICON_STYLE,
    renderItemIcon,
    renderItemBadge,
} from './common';


// --- COMPONENTS ---
const List = ({
    data = [],
    resourceName,
    selectedId,
    onItemClick,
    onToggleActionMenu,
    className,
    ...props
}) => {
    // RENDER
    return (
        <div className={`flex flex-col gap-2 ${className ?? ''}`.trim()} {...props}>
            {data.map((item) => {
                const isSelected = selectedId === item.id;

                return (
                    <div
                        key={item.id}
                        data-record-id={item.id}
                        data-selected={isSelected ? 'true' : 'false'}
                        onClick={() => onItemClick?.(item)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer select-none gap-4 min-w-0 ${isSelected
                            ? 'bg-accent/15 border-accent shadow-xs ring-1 ring-accent/30'
                            : 'bg-surface border-surface-border hover:bg-surface-hover'
                        }`}
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            {resourceName === 'users' ? (
                                <Avatar
                                    src={item.avatarPath}
                                    user={item.user ?? item}
                                    alt={item.title ?? item.name}
                                    size="small"
                                    className="h-9 w-9 shrink-0"
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
                                    {item.department && <span>{typeof item.department === 'object' ? (item.department.name ?? item.department.code) : item.department}</span>}
                                    {item.date && <span>· {item.date}</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            {renderItemBadge(item)}
                            <button
                                type="button"
                                onClick={(event) => onToggleActionMenu?.(event, item)}
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


// --- EXPORTS ---
export { List };
