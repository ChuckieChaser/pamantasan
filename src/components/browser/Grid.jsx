// --- IMPORTS ---
import { Building2, Mail, MoreVertical } from 'lucide-react';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
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
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 max-h-[680px] overflow-y-auto pr-1 ${className ?? ''}`.trim()} {...props}>
            {data.map((item) => {
                const isSelected = selectedId === item.id;

                return (
                    <Container
                        key={item.id}
                        data-record-id={item.id}
                        data-selected={isSelected ? 'true' : 'false'}
                        variant="card"
                        onClick={() => onItemClick?.(item)}
                        className={`p-3.5 sm:p-4 gap-3 justify-between transition-all duration-150 cursor-pointer group select-none min-w-0 rounded-xl ${isSelected
                            ? 'bg-accent/10 border-accent/70 shadow-2xs'
                            : 'bg-surface border-surface-border hover:border-surface-border/90 hover:shadow-2xs hover:bg-surface-hover/30'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2.5 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                                        className={`font-semibold text-xs truncate block ${isSelected ? 'text-accent' : 'text-text'}`}
                                        title={item.title ?? item.name ?? item.subject}
                                    >
                                        {item.title ?? item.name ?? item.subject}
                                    </span>
                                    {item.subtitle && (
                                        <span className="text-[10px] text-text-muted truncate mt-0.5">
                                            {item.subtitle}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="shrink-0">
                                {resourceName === 'users'
                                    ? (renderItemBadge(item, 'status') ?? renderItemBadge(item))
                                    : renderItemBadge(item)}
                            </div>
                        </div>

                        {resourceName === 'users' ? (
                            <div className="flex flex-col gap-1.5 text-xs text-text-muted py-0.5">
                                {item.email && (
                                    <div className="flex items-center gap-2 min-w-0" title={item.email}>
                                        <Mail className="h-3.5 w-3.5 shrink-0 text-text-muted/70" />
                                        <span className="truncate">{item.email}</span>
                                    </div>
                                )}
                                {item.department && (
                                    <div className="flex items-center gap-2 min-w-0" title={item.department}>
                                        <Building2 className="h-3.5 w-3.5 shrink-0 text-text-muted/70" />
                                        <span className="truncate">{typeof item.department === 'object' ? (item.department.name ?? item.department.code) : item.department}</span>
                                    </div>
                                )}
                                {item.role && (
                                    <div className="pt-0.5 flex items-center">
                                        <Badge variant="neutral" label={item.role} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            item.description && (
                                <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                                    {item.description}
                                </p>
                            )
                        )}

                        <div className="flex items-center justify-between text-xs text-text-muted border-t border-surface-border/80 pt-2.5 mt-1">
                            <span className="truncate text-[11px]">
                                {resourceName === 'users'
                                    ? (item.universityId && item.date ? `${item.universityId} · ${item.date}` : (item.universityId || item.date))
                                    : (item.metadata ?? item.department ?? item.date)}
                            </span>
                            <button
                                type="button"
                                onClick={(event) => onToggleActionMenu?.(event, item)}
                                className="text-text-muted hover:text-text p-1 rounded-md hover:bg-surface-hover transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center"
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

