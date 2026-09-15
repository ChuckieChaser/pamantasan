// --- IMPORTS ---
import { useEffect, useState } from 'react';

import { storageService } from '../services';
import placeholderImage from '../assets/placeholder.png';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'rounded-full object-cover bg-surface border border-surface-border shrink-0 overflow-hidden select-none';

const SIZE_STYLE = {
    small:      'h-5 w-5 text-xs',
    medium:     'h-7 w-7 text-xs',
    large:      'h-9 w-9 text-sm',
    extraLarge: 'h-12 w-12 text-base',
};


// --- COMPONENTS ---
const Avatar = ({
    size = 'medium',
    src = null,
    alt = '',
    className,
    ...props
}) => {
    // STATES
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

    // HOOKS
    useEffect(() => {
        let isCancelled = false;

        if (!src || isDirectUrl || src === 'avatars/defaultAvatar.png' || src === '/avatars/defaultAvatar.png') {
            return;
        }

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

    // HANDLERS
    const handleImageError = () => {
        setHasLoadError(true);
    };

    // DERIVED VALUES
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.medium;
    const composedClassName = `${BASE_STYLE} ${sizeStyle} ${className ?? ''}`.trim();
    const effectiveAlt = alt || 'User avatar';

    const activeUrl = isDirectUrl ? src : storageUrl;
    const effectiveSource = !activeUrl || hasLoadError ? placeholderImage : activeUrl;

    // RENDER
    return (
        <img
            src={effectiveSource}
            alt={effectiveAlt}
            onError={handleImageError}
            className={composedClassName}
            {...props}
        />
    );
};


// --- EXPORTS ---
export { Avatar };
