// --- IMPORTS ---


// --- CONFIGURATIONS ---
const ITEM_BASE_STYLE = 'h-9 px-3 rounded-md text-sm font-medium inline-flex items-center gap-2.5 transition-all select-none cursor-pointer touch-manipulation disabled:cursor-not-allowed disabled:opacity-50';
const ICON_STYLE = 'h-4 w-4 shrink-0';

const ITEM_STATE_STYLE = {
    active:   'bg-accent text-text-inverted shadow-xs font-semibold',
    inactive: 'text-text-muted hover:text-text hover:bg-surface-hover',
};


// --- COMPONENTS ---
export const Navigation = ({
    items = [],
    activeKey,
    onChange,
    orientation = 'vertical',
    isCollapsed = false,
    className = '',
    ...props
}) => {
    // --- HANDLERS ---
    const handleClick = (itemKey) => {
        onChange?.(itemKey);
    };

    // --- DERIVED VALUES ---
    const containerOrientation = orientation === 'horizontal'
        ? 'flex flex-row items-center gap-1.5 overflow-x-auto no-scrollbar py-1'
        : 'flex flex-col gap-1 w-full';

    // --- RENDER ---
    return (
        <nav
            aria-label="Sidebar navigation"
            className={`${containerOrientation} ${className}`.trim()}
            {...props}
        >
            {items.map((item) => {
                const isActive = item.key === activeKey || item.value === activeKey;
                const stateStyle = isActive ? ITEM_STATE_STYLE.active : ITEM_STATE_STYLE.inactive;
                const widthStyle = isCollapsed && orientation === 'vertical' ? 'w-9 p-0 justify-center' : 'w-full';
                const Icon = item.icon;

                return (
                    <button
                        key={item.key ?? item.value}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => handleClick(item.key ?? item.value)}
                        title={item.label ?? item.title}
                        className={`${ITEM_BASE_STYLE} ${widthStyle} ${stateStyle}`}
                    >
                        {Icon && (
                            typeof Icon === 'function' ? (
                                <Icon className={ICON_STYLE} />
                            ) : (
                                Icon
                            )
                        )}

                        {(!isCollapsed || orientation === 'horizontal') && item.label && (
                            <span className="truncate">{item.label}</span>
                        )}

                        {item.badge && (
                            <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                                isActive ? 'bg-white/20 text-white' : 'bg-surface-hover text-text-muted'
                            }`}>
                                {item.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </nav>
    );
};
