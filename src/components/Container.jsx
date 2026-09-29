// --- IMPORTS ---
import { forwardRef } from 'react';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'flex flex-col text-text';

const VARIANT_STYLE = {
    dropdown: 'p-1.5 sm:p-2 gap-1 bg-surface border border-surface-border rounded-md shadow-md',
    card:     'p-3 sm:p-4 gap-2.5 sm:gap-3 bg-surface border border-surface-border rounded-xl shadow-xs',
    panel:    'p-3.5 sm:p-5 gap-3 sm:gap-4 bg-surface border border-surface-border rounded-xl shadow-xl',
    page:     'p-2 sm:p-3 md:p-4 gap-2.5 sm:gap-3.5 bg-background',
};


// --- COMPONENTS ---
const Container = forwardRef(({
    variant = 'panel',
    className,
    children,
    ...props
}, ref) => {
    // DERIVED VALUES
    const variantStyle = VARIANT_STYLE[variant] ?? VARIANT_STYLE.panel;
    const composedClassName = `${BASE_STYLE} ${variantStyle} ${className ?? ''}`.trim();

    // RENDER
    return (
        <div
            ref={ref}
            className={composedClassName}
            {...props}
        >
            {children}
        </div>
    );
});

Container.displayName = 'Container';


// --- EXPORTS ---
export { Container };
