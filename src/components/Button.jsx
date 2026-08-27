// --- IMPORTS ---
import { cloneElement, isValidElement } from 'react';
import { Loader2 } from 'lucide-react';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'inline-flex items-center justify-center font-medium rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const ICON_STYLE = 'h-4 w-4 shrink-0';

const SIZE_STYLE = {
    sm: 'h-8 px-3 text-sm gap-2',
    md: 'h-10 px-4 text-base gap-2',
    lg: 'h-12 px-6 text-lg gap-3',
};

const VARIANT_STYLE = {
    primary: 'bg-accent text-text-inverted hover:bg-accent-hover',
    secondary: 'bg-surface text-text border border-surface-border hover:bg-surface-hover',
    destructive: 'bg-error text-text-inverted hover:bg-error-hover',
};

// --- COMPONENTS ---
const Button = ({
    variant = 'primary',
    size = 'sm',
    type = 'button',
    disabled = false,
    loading = false,
    label,
    leadingIcon,
    trailingIcon,
    onClick,
    className,
    children,
    ...props
}) => {
    // GUARD CLAUSES
    // (none — all states handled via disabled/loading props)

    // HANDLERS
    const handleClick = (event) => {
        if (disabled || loading) {
            return;
        }

        onClick?.(event);
    };

    // DERIVED VALUES
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.sm;
    const variantStyle = VARIANT_STYLE[variant] ?? VARIANT_STYLE.primary;
    const composedClassName = `${BASE_STYLE} ${sizeStyle} ${variantStyle} ${className ?? ''}`.trim();

    const renderedLeadingIcon = loading
        ? <Loader2 className={`${ICON_STYLE} animate-spin`} />
        : renderIcon(leadingIcon);

    const renderedTrailingIcon = renderIcon(trailingIcon);

    // RENDER
    return (
        <button
            type={type}
            disabled={disabled || loading}
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

const PrimaryButton = (props) => <Button variant="primary" {...props} />;
const SecondaryButton = (props) => <Button variant="secondary" {...props} />;
const DestructiveButton = (props) => <Button variant="destructive" {...props} />;

export {
    Button,
    PrimaryButton,
    SecondaryButton,
    DestructiveButton,
};

export default Button;

// --- HELPERS ---
function renderIcon(icon) {
    if (!icon) {
        return null;
    }

    if (isValidElement(icon)) {
        const iconClassName = `${ICON_STYLE} ${icon.props.className ?? ''}`.trim();
        return cloneElement(icon, { className: iconClassName });
    }

    const IconComponent = icon;
    return <IconComponent className={ICON_STYLE} />;
}
