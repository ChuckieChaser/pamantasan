// --- IMPORTS ---


// --- CONFIGURATIONS ---
const CONTAINER_STYLE = 'h-9 inline-flex items-center p-1 bg-surface-hover border border-surface-border rounded-md gap-1 box-border select-none max-w-full overflow-x-auto no-scrollbar shrink-0';
const ITEM_BASE_STYLE = 'h-7 px-2.5 text-xs font-medium rounded-sm inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap touch-manipulation disabled:cursor-not-allowed disabled:opacity-40';
const ICON_STYLE = 'h-3.5 w-3.5 shrink-0';

const ITEM_STATE_STYLE = {
    active:   'bg-surface text-text shadow-xs font-semibold',
    inactive: 'text-text-muted hover:text-text hover:bg-surface/50',
};


// --- COMPONENTS ---
export const SegmentedControl = ({
    value,
    options = [],
    isDisabled = false,
    onChange,
    className = '',
    ...props
}) => {
    // --- HANDLERS ---
    const handleSelect = (optionValue) => {
        if (isDisabled) {
            return;
        }

        onChange?.(optionValue);
    };

    // --- DERIVED VALUES ---
    const composedContainerClassName = `${CONTAINER_STYLE} ${className}`.trim();

    // --- RENDER ---
    return (
        <div
            role="radiogroup"
            className={composedContainerClassName}
            {...props}
        >
            {options.map((option) => {
                const isActive = option.value === value;
                const isOptionDisabled = isDisabled || Boolean(option.isDisabled || option.disabled);
                const stateStyle = isActive
                    ? ITEM_STATE_STYLE.active
                    : ITEM_STATE_STYLE.inactive;
                const itemClassName = `${ITEM_BASE_STYLE} ${stateStyle}`.trim();
                const OptionIcon = option.icon;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        disabled={isOptionDisabled}
                        onClick={() => handleSelect(option.value)}
                        className={itemClassName}
                        title={option.title ?? option.label}
                    >
                        {OptionIcon && (
                            typeof OptionIcon === 'function' ? (
                                <OptionIcon className={ICON_STYLE} />
                            ) : (
                                OptionIcon
                            )
                        )}

                        {option.label && <span>{option.label}</span>}
                    </button>
                );
            })}
        </div>
    );
};
