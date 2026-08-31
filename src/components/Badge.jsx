// --- IMPORTS ---
import { cloneElement, isValidElement } from 'react';
import {
    CheckCircle2,
    XCircle,
    Info,
    Shield,
    Crown,
    GraduationCap,
    FileCheck,
    User,
    Clock,
    Archive,
    Globe,
    Lock,
    EyeOff,
} from 'lucide-react';
import {
    USER_ROLES,
    USER_STATUSES,
    DOCUMENT_CLASSIFICATIONS,
    DOCUMENT_SHARE_STATUSES,
    DOCUMENT_REQUEST_STATUSES,
    COORDINATOR_REQUEST_STATUSES,
} from '../constants';

// --- CONFIGURATIONS ---
const BASE_STYLE = 'inline-flex items-center justify-center font-medium rounded-full transition-colors select-none';

const SIZE_STYLE = {
    sm: 'h-5 px-2 text-xs gap-1',
    md: 'h-6 px-3 text-xs gap-1.5',
    lg: 'h-7 px-3 text-sm gap-2',
};

const ICON_SIZE_STYLE = {
    sm: 'h-3 w-3 shrink-0',
    md: 'h-3.5 w-3.5 shrink-0',
    lg: 'h-4 w-4 shrink-0',
};

const DOT_SIZE_STYLE = {
    sm: 'h-1.5 w-1.5 rounded-full shrink-0',
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
    [USER_ROLES.ADMINISTRATOR]: {
        label: 'Administrator',
        variant: 'information',
        icon: Shield,
    },
    [USER_ROLES.COORDINATOR]: {
        label: 'Coordinator',
        variant: 'warning',
        icon: FileCheck,
    },
    [USER_ROLES.DIRECTOR]: {
        label: 'Director',
        variant: 'success',
        icon: Crown,
    },
    [USER_ROLES.OFFICER]: {
        label: 'Officer',
        variant: 'warning',
        icon: FileCheck,
    },
    [USER_ROLES.MEMBER]: {
        label: 'Member',
        variant: 'neutral',
        icon: GraduationCap,
    },
};

const STATUS_CONFIG = {
    // 1. COORDINATOR REQUEST STATUSES
    [COORDINATOR_REQUEST_STATUSES.PENDING]: {
        label: 'Pending Review',
        variant: 'warning',
        icon: Clock,
    },
    [COORDINATOR_REQUEST_STATUSES.APPROVED]: {
        label: 'Approved',
        variant: 'success',
        icon: CheckCircle2,
    },
    [COORDINATOR_REQUEST_STATUSES.REJECTED]: {
        label: 'Rejected',
        variant: 'error',
        icon: XCircle,
    },

    // 2. DOCUMENT REQUEST STATUSES
    [DOCUMENT_REQUEST_STATUSES.OPEN]: {
        label: 'Open',
        variant: 'warning',
        icon: Clock,
    },
    [DOCUMENT_REQUEST_STATUSES.RESOLVED]: {
        label: 'Resolved',
        variant: 'success',
        icon: CheckCircle2,
    },

    // 3. DOCUMENT SHARE STATUSES
    [DOCUMENT_SHARE_STATUSES.PENDING_APPROVAL]: {
        label: 'Pending Approval',
        variant: 'warning',
        icon: Clock,
    },
    [DOCUMENT_SHARE_STATUSES.APPROVED]: {
        label: 'Approved',
        variant: 'success',
        icon: CheckCircle2,
    },
    [DOCUMENT_SHARE_STATUSES.PUBLISHED]: {
        label: 'Published',
        variant: 'success',
        icon: CheckCircle2,
    },
    [DOCUMENT_SHARE_STATUSES.STASHED]: {
        label: 'Archived',
        variant: 'neutral',
        icon: Archive,
    },
    [DOCUMENT_SHARE_STATUSES.DRAFT]: {
        label: 'Draft',
        variant: 'neutral',
        icon: Info,
    },

    // 4. USER STATUSES
    [USER_STATUSES.VERIFIED]: {
        label: 'Verified',
        variant: 'success',
        icon: CheckCircle2,
    },
    [USER_STATUSES.SUSPENDED]: {
        label: 'Suspended',
        variant: 'error',
        icon: XCircle,
    },
    [USER_STATUSES.INACTIVE]: {
        label: 'Inactive',
        variant: 'neutral',
        icon: Info,
    },

    // 5. GENERIC LITERAL FALLBACKS
    Active: {
        label: 'Active',
        variant: 'success',
        icon: CheckCircle2,
    },
    Pending: {
        label: 'Pending',
        variant: 'warning',
        icon: Clock,
    },
    Open: {
        label: 'Open',
        variant: 'warning',
        icon: Clock,
    },
    Resolved: {
        label: 'Resolved',
        variant: 'success',
        icon: CheckCircle2,
    },
    Rejected: {
        label: 'Rejected',
        variant: 'error',
        icon: XCircle,
    },
};

const CLASSIFICATION_CONFIG = {
    [DOCUMENT_CLASSIFICATIONS.PUBLIC]: {
        label: 'Public',
        variant: 'success',
        icon: Globe,
    },
    [DOCUMENT_CLASSIFICATIONS.PRIVATE]: {
        label: 'Private',
        variant: 'information',
        icon: EyeOff,
    },
    [DOCUMENT_CLASSIFICATIONS.CONFIDENTIAL]: {
        label: 'Confidential',
        variant: 'error',
        icon: Shield,
    },
    [DOCUMENT_CLASSIFICATIONS.RESTRICTED]: {
        label: 'Restricted',
        variant: 'warning',
        icon: Lock,
    },
    [DOCUMENT_CLASSIFICATIONS.UNCLASSIFIED]: {
        label: 'Unclassified',
        variant: 'neutral',
        icon: Info,
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
    // DERIVED VALUES
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
    role = USER_ROLES.MEMBER,
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

// 4. CANONICAL STATUS BADGE (INTELLIGENT SEMANTIC MAPPING)
const StatusBadge = ({
    status,
    label,
    leadingIcon,
    variant,
    showIcon = false,
    ...props
}) => {
    if (!status && !label) {
        return null;
    }

    const rawStatus = status ?? label;
    const uppercaseStatus = typeof rawStatus === 'string' ? rawStatus.toUpperCase() : rawStatus;

    // Direct lookup or case-insensitive match
    const matchedConfiguration = STATUS_CONFIG[rawStatus] ?? STATUS_CONFIG[uppercaseStatus] ?? {
        label: String(rawStatus),
        variant: uppercaseStatus?.includes?.('PENDING') || uppercaseStatus?.includes?.('OPEN')
            ? 'warning'
            : uppercaseStatus?.includes?.('REJECT') || uppercaseStatus?.includes?.('SUSPEND')
            ? 'error'
            : uppercaseStatus?.includes?.('APPROV') || uppercaseStatus?.includes?.('RESOLV') || uppercaseStatus?.includes?.('VERIF') || uppercaseStatus?.includes?.('ACTIVE')
            ? 'success'
            : 'neutral',
        icon: Info,
    };

    const effectiveVariant = variant ?? matchedConfiguration.variant;
    const effectiveLabel = label ?? matchedConfiguration.label;
    const effectiveIcon = showIcon ? (leadingIcon ?? matchedConfiguration.icon) : leadingIcon;

    return (
        <Badge
            variant={effectiveVariant}
            leadingIcon={effectiveIcon}
            label={effectiveLabel}
            {...props}
        />
    );
};

// 5. CLASSIFICATION BADGE
const ClassificationBadge = ({
    classification,
    label,
    leadingIcon,
    variant,
    showIcon = false,
    ...props
}) => {
    if (!classification && !label) {
        return null;
    }

    const rawClassification = classification ?? label;
    const matchedConfiguration = CLASSIFICATION_CONFIG[rawClassification] ?? {
        label: String(rawClassification),
        variant: 'neutral',
        icon: Info,
    };

    const effectiveVariant = variant ?? matchedConfiguration.variant;
    const effectiveLabel = label ?? matchedConfiguration.label;
    const effectiveIcon = showIcon ? (leadingIcon ?? matchedConfiguration.icon) : leadingIcon;

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
    StatusBadge,
    ClassificationBadge,
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
