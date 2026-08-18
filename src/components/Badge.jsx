// --- IMPORTS ---
import { cloneElement, isValidElement } from 'react';
import {
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Info,
    Shield,
    Crown,
    GraduationCap,
    FileCheck,
    User,
} from 'lucide-react';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'inline-flex items-center justify-center font-medium rounded-full transition-colors select-none';

const SIZE_STYLE = {
    sm: 'h-5 px-2 text-xs gap-1',
    md: 'h-6 px-3 text-xs gap-1',
    lg: 'h-7 px-3 text-sm gap-2',
};

const ICON_SIZE_STYLE = {
    sm: 'h-3 w-3 shrink-0',
    md: 'h-4 w-4 shrink-0',
    lg: 'h-4 w-4 shrink-0',
};

const DOT_SIZE_STYLE = {
    sm: 'h-1 w-1 rounded-full shrink-0',
    md: 'h-2 w-2 rounded-full shrink-0',
    lg: 'h-2 w-2 rounded-full shrink-0',
};

const VARIANT_STYLE = {
    neutral: 'bg-surface-hover text-text-muted border border-surface-border',
    success: 'bg-accent-background text-accent border border-accent-border',
    error: 'bg-error-background text-error border border-error-border',
    warning: 'bg-warning-background text-warning border border-warning-border',
    information: 'bg-information-background text-information border border-information-border',
};

const DOT_COLOR_STYLE = {
    neutral: 'bg-text-muted',
    success: 'bg-accent',
    error: 'bg-error',
    warning: 'bg-warning',
    information: 'bg-information',
};

const ROLE_CONFIG = {
    admin: {
        label: 'Administrator',
        variant: 'information',
        icon: Shield,
    },
    dean: {
        label: 'Dean',
        variant: 'success',
        icon: Crown,
    },
    faculty: {
        label: 'Faculty',
        variant: 'neutral',
        icon: GraduationCap,
    },
    reviewer: {
        label: 'Reviewer',
        variant: 'warning',
        icon: FileCheck,
    },
    student: {
        label: 'Student',
        variant: 'neutral',
        icon: User,
    },
};

// --- COMPONENTS ---

// 1. BASE BADGE COMPONENT
const Badge = ({
    variant = 'neutral',
    size = 'sm',
    dot = false,
    label,
    leadingIcon,
    trailingIcon,
    className,
    children,
    ...props
}) => {
    // STYLES
    const variantStyle = VARIANT_STYLE[variant] ?? VARIANT_STYLE.neutral;
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.sm;
    const iconSizeStyle = ICON_SIZE_STYLE[size] ?? ICON_SIZE_STYLE.sm;
    const dotSizeStyle = DOT_SIZE_STYLE[size] ?? DOT_SIZE_STYLE.sm;
    const dotColorStyle = DOT_COLOR_STYLE[variant] ?? DOT_COLOR_STYLE.neutral;

    const composedClassName = `${BASE_STYLE} ${sizeStyle} ${variantStyle} ${className ?? ''}`.trim();
    const dotClassName = `${dotSizeStyle} ${dotColorStyle}`.trim();

    // RENDER
    return (
        <span
            className={composedClassName}
            {...props}
        >
            {dot && <span className={dotClassName} />}
            {leadingIcon && renderIcon(leadingIcon, iconSizeStyle)}
            {children ?? label}
            {trailingIcon && renderIcon(trailingIcon, iconSizeStyle)}
        </span>
    );
};

// 2. SEMANTIC STATUS BADGES
const SuccessBadge = (props) => <Badge variant="success" {...props} />;
const ErrorBadge = (props) => <Badge variant="error" {...props} />;
const WarningBadge = (props) => <Badge variant="warning" {...props} />;
const InformationBadge = (props) => <Badge variant="information" {...props} />;
const InfoBadge = (props) => <Badge variant="information" {...props} />;

// 3. ROLE BADGE
const RoleBadge = ({
    role = 'faculty',
    label,
    leadingIcon,
    variant,
    ...props
}) => {
    // DERIVED VALUES
    const roleConfiguration = ROLE_CONFIG[role] ?? {
        label: role,
        variant: 'neutral',
        icon: User,
    };

    const effectiveVariant = variant ?? roleConfiguration.variant;
    const effectiveLabel = label ?? roleConfiguration.label;
    const effectiveIcon = leadingIcon ?? roleConfiguration.icon;

    // RENDER
    return (
        <Badge
            variant={effectiveVariant}
            leadingIcon={effectiveIcon}
            label={effectiveLabel}
            {...props}
        />
    );
};

export {
    Badge,
    SuccessBadge,
    ErrorBadge,
    WarningBadge,
    InformationBadge,
    InfoBadge,
    RoleBadge,
};

export default Badge;

// --- HELPERS ---
function renderIcon(icon, customIconStyle) {
    if (!icon) {
        return null;
    }

    if (isValidElement(icon)) {
        const iconClassName = `${customIconStyle} ${icon.props.className ?? ''}`.trim();
        return cloneElement(icon, { className: iconClassName });
    }

    const IconComponent = icon;
    return <IconComponent className={customIconStyle} />;
}
