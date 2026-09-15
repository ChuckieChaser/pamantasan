// --- IMPORTS ---
import { renderIcon } from './common';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'h-5 px-2 text-xs rounded-full gap-1 inline-flex items-center justify-center font-medium transition-colors select-none';
const ICON_STYLE = 'h-3 w-3 shrink-0';

const VARIANT_STYLE = {
    neutral:     'bg-surface-hover text-text-muted border border-surface-border',
    success:     'bg-accent-background text-accent border border-accent-border',
    error:       'bg-error-background text-error border border-error-border',
    warning:     'bg-warning-background text-warning border border-warning-border',
    information: 'bg-information-background text-information border border-information-border',
};


// --- COMPONENTS ---
const Badge = ({
    variant = 'neutral',
    label,
    leadingIcon,
    trailingIcon,
    className,
    children,
    ...props
}) => {
    // DERIVED VALUES
    const variantStyle = VARIANT_STYLE[variant] ?? VARIANT_STYLE.neutral;
    const composedClassName = `${BASE_STYLE} ${variantStyle} ${className ?? ''}`.trim();

    const renderedLeadingIcon = renderIcon(leadingIcon, ICON_STYLE);
    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    // RENDER
    return (
        <span
            className={composedClassName}
            {...props}
        >
            {renderedLeadingIcon}
            {children ?? label}
            {renderedTrailingIcon}
        </span>
    );
};


// --- EXPORTS ---
export { Badge };
