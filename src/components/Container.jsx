// --- CONFIGURATIONS ---
const BASE_STYLE = 'flex flex-col text-text';

const VARIANT_STYLE = {
    dropdown: 'p-2 gap-1 bg-surface border border-surface-border rounded-md shadow-md',
    card:     'p-4 gap-3 bg-surface border border-surface-border rounded-xl shadow-sm',
    panel:    'p-6 gap-4 bg-surface border border-surface-border rounded-xl shadow-xl',
    page:     'p-8 gap-6 bg-background',
};


// --- COMPONENTS ---
const Container = ({
    variant = 'panel',
    className,
    children,
    ...props
}) => {
    // DERIVED VALUES
    const variantStyle = VARIANT_STYLE[variant] ?? VARIANT_STYLE.panel;
    const composedClassName = `${BASE_STYLE} ${variantStyle} ${className ?? ''}`.trim();

    // RENDER
    return (
        <div
            className={composedClassName}
            {...props}
        >
            {children}
        </div>
    );
};


// --- EXPORTS ---
export { Container };
