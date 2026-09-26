// --- IMPORTS ---
import { Loader2 } from 'lucide-react';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'h-9 px-3 text-sm font-medium rounded-md gap-2 inline-flex items-center justify-center transition-all select-none cursor-pointer touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]';
const ICON_STYLE = 'h-4 w-4 shrink-0';

const VARIANT_STYLE = {
    primary:     'bg-accent text-text-inverted hover:bg-accent-hover shadow-xs',
    secondary:   'bg-surface text-text border border-surface-border hover:bg-surface-hover shadow-xs',
    destructive: 'bg-error text-text-inverted hover:bg-error-hover shadow-xs',
    outline:     'bg-transparent text-text border border-surface-border hover:bg-surface-hover',
    ghost:       'bg-transparent text-text hover:bg-surface-hover hover:text-text',
};

const SIZE_STYLE = {
    sm: 'h-7 px-2.5 text-xs',
    md: 'h-9 px-3 text-sm',
    lg: 'h-10 px-4 text-sm',
};


// --- COMPONENTS ---
export const Button = ({
    variant = 'primary',
    size = 'md',
    type = 'button',
    label,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    isDisabled = false,
    isLoading = false,
    onClick,
    className = '',
    children,
    ...props
}) => {
    // --- HANDLERS ---
    const handleClick = (event) => {
        if (isDisabled || isLoading) {
            event?.preventDefault?.();
            return;
        }

        onClick?.(event);
    };

    // --- DERIVED VALUES ---
    const selectedVariant = VARIANT_STYLE[variant] ?? VARIANT_STYLE.primary;
    const selectedSize = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const composedClassName = `${BASE_STYLE} ${selectedSize} ${selectedVariant} ${className}`.trim();

    // --- RENDER ---
    return (
        <button
            type={type}
            disabled={isDisabled || isLoading}
            onClick={handleClick}
            className={composedClassName}
            {...props}
        >
            {isLoading ? (
                <Loader2 className={`${ICON_STYLE} animate-spin`} />
            ) : LeadingIcon ? (
                typeof LeadingIcon === 'function' ? <LeadingIcon className={ICON_STYLE} /> : LeadingIcon
            ) : null}

            {children ?? (label ? <span>{label}</span> : null)}

            {TrailingIcon && !isLoading ? (
                typeof TrailingIcon === 'function' ? <TrailingIcon className={ICON_STYLE} /> : TrailingIcon
            ) : null}
        </button>
    );
};
