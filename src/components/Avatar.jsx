// --- IMPORTS ---
import { useState, useEffect } from 'react';
import placeholderImage from '../assets/placeholder.png';

// --- MODULE-LEVEL CONSTANTS ---
const SIZE_STYLE = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
    '2xl': 'h-20 w-20',
};

const BASE_CONTAINER_STYLE =
    'rounded-full object-cover bg-surface border border-surface-border shrink-0 overflow-hidden shadow-xs select-none';

// --- COMPONENT DEFINITION ---
function UserAvatar({
    src = null,
    name = '',
    alt = '',
    size = 'md',
    className = '',
    ...props
}) {
    // 4. GUARD CLAUSES / STATES
    const [hasLoadError, setHasLoadError] = useState(false);

    useEffect(() => {
        setHasLoadError(false);
    }, [src]);

    // 5. HANDLERS
    const handleImageError = () => {
        setHasLoadError(true);
    };

    // 6. DERIVED VALUES
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const effectiveSource = !src || hasLoadError ? placeholderImage : src;
    const effectiveAlt = alt || name || 'User avatar';

    // 7. RETURN
    return (
        <img
            src={effectiveSource}
            alt={effectiveAlt}
            onError={handleImageError}
            className={`${BASE_CONTAINER_STYLE} ${sizeStyle} ${className}`}
            {...props}
        />
    );
}

export {
    UserAvatar,
    UserAvatar as Avatar,
};

export default UserAvatar;
