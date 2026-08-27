// --- CONFIGURATIONS ---
const BASE_STYLE = 'flex flex-col text-text';

const VARIANT_STYLE = {
    page: 'w-full gap-6',
    panel: 'p-4 bg-surface border border-surface-border rounded-lg gap-4',
    card: 'p-4 bg-surface border border-surface-border rounded-xl shadow-lg gap-3',
    dropdown: 'p-2 bg-surface border border-surface-border rounded-md shadow-md gap-1 min-w-48',
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

const PageContainer = (props) => <Container variant="page" {...props} />;
const PanelContainer = (props) => <Container variant="panel" {...props} />;
const CardContainer = (props) => <Container variant="card" {...props} />;
const DropdownContainer = (props) => <Container variant="dropdown" {...props} />;

export {
    Container,
    PageContainer,
    PanelContainer,
    CardContainer,
    DropdownContainer,
};

export default Container;
