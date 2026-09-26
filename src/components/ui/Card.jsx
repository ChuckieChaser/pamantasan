// --- IMPORTS ---


// --- CONFIGURATIONS ---
const BASE_STYLE = 'flex flex-col text-text overflow-hidden transition-all';

const VARIANT_STYLE = {
    default:     'bg-surface border border-surface-border rounded-xl shadow-xs',
    interactive: 'bg-surface border border-surface-border rounded-xl shadow-xs hover:border-accent hover:shadow-sm cursor-pointer active:scale-[0.995] touch-manipulation',
    flat:        'bg-surface border border-surface-border rounded-xl',
    subtle:      'bg-surface-hover border border-surface-border rounded-xl',
};

const PADDING_STYLE = {
    none: 'p-0',
    sm:   'p-3',
    md:   'p-4 sm:p-5',
    lg:   'p-5 sm:p-6',
};


// --- COMPONENTS ---
export const Card = ({
    variant = 'default',
    padding = 'md',
    className = '',
    children,
    ...props
}) => {
    // --- DERIVED VALUES ---
    const selectedVariant = VARIANT_STYLE[variant] ?? VARIANT_STYLE.default;
    const selectedPadding = PADDING_STYLE[padding] ?? PADDING_STYLE.md;
    const composedClassName = `${BASE_STYLE} ${selectedVariant} ${selectedPadding} ${className}`.trim();

    // --- RENDER ---
    return (
        <div
            className={composedClassName}
            {...props}
        >
            {children}
        </div>
    );
};
