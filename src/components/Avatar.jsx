// --- IMPORTS ---
import { useState, useEffect } from 'react';
import placeholderImage from '../assets/placeholder.png';
import { storageService } from '../services';

// --- MODULE-LEVEL CONSTANTS ---
const SIZE_STYLE = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
    '2xl': 'h-20 w-20 text-xl',
};

const BASE_CONTAINER_STYLE =
    'rounded-full object-cover bg-surface border border-surface-border shrink-0 overflow-hidden shadow-xs select-none';

function getInitialsAvatarUrl(name) {
    const trimmedName = (name ?? '').trim() || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedName)}&background=0f5132&color=ffffff&bold=true&format=svg`;
}

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
    const isDirectUrl = Boolean(
        src &&
        (src.startsWith('http://') ||
         src.startsWith('https://') ||
         src.startsWith('data:') ||
         src.startsWith('blob:'))
    );

    const [storageUrl, setStorageUrl] = useState(null);
    const [hasLoadError, setHasLoadError] = useState(false);
    const [previousSource, setPreviousSource] = useState(src);

    if (src !== previousSource) {
        setPreviousSource(src);
        setStorageUrl(null);
        setHasLoadError(false);
    }

    useEffect(() => {
        let isCancelled = false;

        if (!src || isDirectUrl) {
            return;
        }

        // Resolve Firebase Storage pointer path asynchronously
        storageService
            .getFileDownloadUrl(src)
            .then((downloadUrl) => {
                if (!isCancelled) {
                    if (downloadUrl) {
                        setStorageUrl(downloadUrl);
                    } else {
                        setHasLoadError(true);
                    }
                }
            })
            .catch(() => {
                if (!isCancelled) {
                    setHasLoadError(true);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [src, isDirectUrl]);

    // 5. HANDLERS
    const handleImageError = () => {
        setHasLoadError(true);
    };

    // 6. DERIVED VALUES
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const autoAvatarUrl = getInitialsAvatarUrl(name || alt);
    const activeUrl = isDirectUrl ? src : storageUrl;
    const effectiveSource = !activeUrl || hasLoadError ? (hasLoadError && !activeUrl ? placeholderImage : autoAvatarUrl) : activeUrl;
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

