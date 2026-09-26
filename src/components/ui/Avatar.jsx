// --- IMPORTS ---
import { useState } from 'react';
import defaultAvatarSvg from '../../assets/icons/defaultAvatar.svg';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'relative inline-flex shrink-0 rounded-full select-none items-center justify-center bg-surface-hover border border-surface-border overflow-hidden';

const SIZE_STYLE = {
    xs: 'h-5 w-5 text-[10px]',
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-xs',
    lg: 'h-10 w-10 text-sm',
    xl: 'h-12 w-12 text-base',
};

const STATUS_STYLE = {
    online:  'bg-accent',
    busy:    'bg-error',
    away:    'bg-warning',
    offline: 'bg-surface-border',
};

const STATUS_SIZE_STYLE = {
    xs: 'h-1.5 w-1.5 bottom-0 right-0',
    sm: 'h-2 w-2 bottom-0 right-0',
    md: 'h-2.5 w-2.5 bottom-0 right-0',
    lg: 'h-3 w-3 bottom-0.5 right-0.5',
    xl: 'h-3.5 w-3.5 bottom-0.5 right-0.5',
};


// --- COMPONENTS ---
export const Avatar = ({
    src,
    alt = 'User avatar',
    size = 'md',
    fallback = defaultAvatarSvg,
    status = null,
    className = '',
    ...props
}) => {
    // --- HOOKS & STATE ---
    const [hasError, setHasError] = useState(false);

    // --- DERIVED VALUES ---
    const selectedSize = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const composedContainerClassName = `${BASE_STYLE} ${selectedSize} ${className}`.trim();
    const effectiveSource = !hasError && src ? src : fallback;
    const isStatusVisible = Boolean(status && STATUS_STYLE[status]);
    const statusDotClass = isStatusVisible
        ? `absolute rounded-full ring-2 ring-surface ${STATUS_STYLE[status]} ${STATUS_SIZE_STYLE[size] ?? STATUS_SIZE_STYLE.md}`
        : '';

    // --- HANDLERS ---
    const handleError = () => {
        setHasError(true);
    };

    // --- RENDER ---
    return (
        <div className="relative inline-flex shrink-0">
            <div
                className={composedContainerClassName}
                {...props}
            >
                <img
                    src={effectiveSource}
                    alt={alt}
                    onError={handleError}
                    className="h-full w-full object-cover"
                />
            </div>

            {isStatusVisible && (
                <span
                    className={statusDotClass}
                    aria-hidden="true"
                />
            )}
        </div>
    );
};
