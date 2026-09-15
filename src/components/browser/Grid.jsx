// --- IMPORTS ---
import { MoreVertical } from 'lucide-react';
import { Avatar } from '../Avatar';
import { Container } from '../Container';
import {
    ICON_STYLE,
    renderItemIcon,
    renderItemBadge,
} from './common';


// --- COMPONENTS ---
const Grid = ({
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
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className ?? ''}`.trim()} {...props}>
            {data.map((item) => {
                const isSelected = selectedId === item.id;

                return (
                    <Container
                        key={item.id}
                        variant="card"
                        onClick={() => onItemClick?.(item)}
                        className={`p-4 gap-3 justify-between transition-colors cursor-pointer group select-none min-w-0 ${isSelected
                            ? 'bg-accent-background border-accent'
                            : 'bg-surface border-surface-border hover:border-accent-border'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3 min-w-0">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                {resourceName === 'users' ? (
                                    <Avatar
                                        src={item.avatar_path}
                                        alt={item.title ?? item.name}
                                        size="medium"
                                        className="h-10 w-10 shrink-0"
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

                        <div className="flex items-center justify-between text-xs text-text-muted border-t border-surface-border pt-3">
                            <span className="truncate">{item.metadata ?? item.department ?? item.date}</span>
                            <button
                                type="button"
                                onClick={(event) => onToggleActionMenu?.(event, item)}
                                className="text-text-muted hover:text-text p-1 rounded hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
                                title="Item actions"
                                aria-label="Item actions"
                            >
                                <MoreVertical className={ICON_STYLE} />
                            </button>
                        </div>
                    </Container>
                );
            })}
        </div>
    );
};


// --- EXPORTS ---
export { Grid };
