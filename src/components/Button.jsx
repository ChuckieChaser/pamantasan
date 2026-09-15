// --- IMPORTS ---
import { Loader2 } from 'lucide-react';
import { renderIcon } from './common';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'h-9 py-1 px-3 text-sm rounded-md gap-2 inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const ICON_STYLE = 'h-4 w-4 shrink-0';

const VARIANT_STYLE = {
    primary:     'bg-accent text-text-inverted hover:bg-accent-hover',
    secondary:   'bg-surface text-text border border-surface-border hover:bg-surface-hover',
    destructive: 'bg-error text-text-inverted hover:bg-error-hover',
};


// --- COMPONENTS ---
const Button = ({
    variant = 'primary',
    type = 'button',
    label,
    leadingIcon,
    trailingIcon,
    isDisabled = false,
    isLoading = false,
    onClick,
    className,
    children,
    ...props
}) => {
    // HANDLERS
    const handleClick = (event) => {
        if (isDisabled || isLoading) {
            return;
        }

        onClick?.(event);
    };

    // DERIVED VALUES
    const variantStyle = VARIANT_STYLE[variant] ?? VARIANT_STYLE.primary;
    const composedClassName = `${BASE_STYLE} ${variantStyle} ${className ?? ''}`.trim();

    const renderedLeadingIcon = isLoading
        ? <Loader2 className={`${ICON_STYLE} animate-spin`} />
        : renderIcon(leadingIcon, ICON_STYLE);

    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    // RENDER
    return (
        <button
            type={type}
            disabled={isDisabled || isLoading}
            onClick={handleClick}
            className={composedClassName}
            {...props}
        >
            {renderedLeadingIcon}

            {children ?? label}
            
            {renderedTrailingIcon}
        </button>
    );
};


// --- EXPORTS ---
export { Button };
