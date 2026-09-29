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
        <div className={`flex flex-col gap-2 max-h-[640px] overflow-y-auto pr-1 ${className ?? ''}`.trim()} {...props}>
            {data.map((item) => {
                const isSelected = selectedId === item.id;

                return (
                    <div
                        key={item.id}
                        data-record-id={item.id}
                        data-selected={isSelected ? 'true' : 'false'}
                        onClick={() => onItemClick?.(item)}
                        className={`group flex items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none gap-3 min-w-0 ${isSelected
                            ? 'bg-accent/10 border-accent/70 shadow-2xs'
                            : 'bg-surface border-surface-border hover:border-surface-border/90 hover:bg-surface-hover/50 hover:shadow-2xs'
                        }`}
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            {resourceName === 'users' ? (
                                <Avatar
                                    src={item.avatarPath}
                                    user={item.user ?? item}
                                    alt={item.title ?? item.name}
                                    size="small"
                                    className="h-9 w-9 rounded-full aspect-square shrink-0 ring-1 ring-surface-border"
                                />
                            ) : (
                                <div
                                    className={`p-2 rounded-xl transition-colors shrink-0 ${isSelected
                                        ? 'bg-accent text-text-inverted shadow-2xs'
                                        : 'bg-surface-hover text-accent group-hover:bg-accent/10'
                                    }`}
                                >
                                    {renderItemIcon(item, resourceName)}
                                </div>
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                                <span
                                    className={`font-normal text-xs sm:text-[13px] truncate block ${isSelected ? 'text-accent font-medium' : 'text-text'}`}
                                    title={item.title ?? item.name ?? item.subject}
                                >
                                    {item.title ?? item.name ?? item.subject}
                                </span>
                                <div className="flex items-center gap-2 text-[11px] text-text-muted truncate mt-0.5">
                                    {item.department && <span>{typeof item.department === 'object' ? (item.department.name ?? item.department.code) : item.department}</span>}
                                    {item.date && <span>· {item.date}</span>}
                                    {item.version && <span>· {item.version}</span>}
                                    {item.size && <span>· {item.size}</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            {renderItemBadge(item)}
                            <button
                                type="button"
                                onClick={(event) => onToggleActionMenu?.(event, item)}
                                className="text-text-muted hover:text-text p-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer inline-flex items-center justify-center"
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

