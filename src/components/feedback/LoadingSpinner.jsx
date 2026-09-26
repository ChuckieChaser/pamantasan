// --- IMPORTS ---
import { Loader2 } from 'lucide-react';


// --- CONFIGURATIONS ---
const SIZE_STYLE = {
    xs: 'h-3.5 w-3.5',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-7 w-7',
    xl: 'h-9 w-9',
};

const VARIANT_STYLE = {
    accent:      'text-accent',
    text:        'text-text',
    muted:       'text-text-muted',
    inverted:    'text-text-inverted',
    error:       'text-error',
    warning:     'text-warning',
    information: 'text-information',
};


// --- COMPONENTS ---
export const LoadingSpinner = ({
    size = 'md',
    variant = 'accent',
    className = '',
    label,
    ...props
}) => {
    // --- DERIVED VALUES ---
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const variantStyle = VARIANT_STYLE[variant] ?? VARIANT_STYLE.accent;
    const composedClassName = `${sizeStyle} ${variantStyle} animate-spin shrink-0 ${className}`.trim();

    // --- RENDER ---
    return (
        <span
            className="inline-flex items-center gap-2 select-none"
            role="status"
            {...props}
        >
            <Loader2 className={composedClassName} />
            {label && <span className="text-xs text-text-muted">{label}</span>}
        </span>
    );
};
