// --- IMPORTS ---
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'p-3 rounded-lg border text-xs sm:text-sm leading-relaxed flex items-start gap-2.5';
const ICON_STYLE = 'h-4 w-4 shrink-0 mt-0.5';

const VARIANT_STYLE = {
    neutral:     'bg-surface-hover border-surface-border text-text',
    accent:      'bg-accent-background border-accent-border text-accent',
    success:     'bg-accent-background border-accent-border text-accent',
    warning:     'bg-warning-background border-warning-border text-warning',
    error:       'bg-error-background border-error-border text-error',
    information: 'bg-information-background border-information-border text-information',
};

const DEFAULT_ICONS = {
    neutral:     Info,
    accent:      CheckCircle2,
    success:     CheckCircle2,
    warning:     AlertTriangle,
    error:       AlertCircle,
    information: Info,
};


// --- COMPONENTS ---
export const Callout = ({
    variant = 'neutral',
    title,
    icon: CustomIcon,
    className = '',
    children,
    ...props
}) => {
    // --- DERIVED VALUES ---
    const selectedVariant = VARIANT_STYLE[variant] ?? VARIANT_STYLE.neutral;
    const IconComponent = CustomIcon ?? DEFAULT_ICONS[variant] ?? Info;
    const composedClassName = `${BASE_STYLE} ${selectedVariant} ${className}`.trim();

    // --- RENDER ---
    return (
        <div
            className={composedClassName}
            {...props}
        >
            {IconComponent && (
                typeof IconComponent === 'function' ? (
                    <IconComponent className={ICON_STYLE} />
                ) : (
                    CustomIcon
                )
            )}

            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                {title && <span className="font-semibold">{title}</span>}
                <div className="text-text opacity-95">{children}</div>
            </div>
        </div>
    );
};
