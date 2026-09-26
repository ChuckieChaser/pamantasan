// --- IMPORTS ---


// --- CONFIGURATIONS ---
const BASE_STYLE = 'inline-flex items-center justify-center font-medium rounded-full select-none transition-colors shrink-0 gap-1';
const ICON_STYLE = 'h-3 w-3 shrink-0';

const VARIANT_STYLE = {
    neutral:     'bg-surface-hover text-text-muted border border-surface-border',
    accent:      'bg-accent-background text-accent border border-accent-border',
    success:     'bg-accent-background text-accent border border-accent-border',
    warning:     'bg-warning-background text-warning border border-warning-border',
    error:       'bg-error-background text-error border border-error-border',
    information: 'bg-information-background text-information border border-information-border',
};

const SIZE_STYLE = {
    sm: 'h-5 px-1.5 text-[11px]',
    md: 'h-6 px-2 text-xs',
};


// --- COMPONENTS ---
export const Badge = ({
    variant = 'neutral',
    size = 'md',
    label,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    className = '',
    children,
    ...props
}) => {
    // --- DERIVED VALUES ---
    const selectedVariant = VARIANT_STYLE[variant] ?? VARIANT_STYLE.neutral;
    const selectedSize = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const composedClassName = `${BASE_STYLE} ${selectedSize} ${selectedVariant} ${className}`.trim();

    // --- RENDER ---
    return (
        <span
            className={composedClassName}
            {...props}
        >
            {LeadingIcon ? (
                typeof LeadingIcon === 'function' ? <LeadingIcon className={ICON_STYLE} /> : LeadingIcon
            ) : null}

            {children ?? (label ? <span>{label}</span> : null)}

            {TrailingIcon ? (
                typeof TrailingIcon === 'function' ? <TrailingIcon className={ICON_STYLE} /> : TrailingIcon
            ) : null}
        </span>
    );
};
