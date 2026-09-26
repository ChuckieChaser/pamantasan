// --- IMPORTS ---


// --- CONFIGURATIONS ---
const BASE_STYLE = 'h-9 inline-flex items-center justify-center rounded-md border text-sm font-medium transition-all cursor-pointer select-none touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] gap-2';
const ICON_STYLE = 'h-4 w-4 shrink-0';

const STATE_STYLE = {
    pressed:   'bg-accent-background text-accent border-accent-border hover:bg-accent-background shadow-xs',
    unpressed: 'bg-surface text-text-muted border-surface-border hover:text-text hover:bg-surface-hover shadow-xs',
};


// --- COMPONENTS ---
export const Toggle = ({
    isPressed = false,
    onChange,
    icon: Icon,
    label,
    isDisabled = false,
    className = '',
    ...props
}) => {
    // --- HANDLERS ---
    const handleClick = (event) => {
        if (isDisabled) {
            return;
        }

        onChange?.(!isPressed, event);
    };

    // --- DERIVED VALUES ---
    const stateStyle = isPressed ? STATE_STYLE.pressed : STATE_STYLE.unpressed;
    const paddingStyle = label ? 'px-3' : 'w-9';
    const composedClassName = `${BASE_STYLE} ${paddingStyle} ${stateStyle} ${className}`.trim();

    // --- RENDER ---
    return (
        <button
            type="button"
            aria-pressed={isPressed}
            disabled={isDisabled}
            onClick={handleClick}
            className={composedClassName}
            {...props}
        >
            {Icon && (
                typeof Icon === 'function' ? (
                    <Icon className={ICON_STYLE} />
                ) : (
                    Icon
                )
            )}

            {label && <span>{label}</span>}
        </button>
    );
};
