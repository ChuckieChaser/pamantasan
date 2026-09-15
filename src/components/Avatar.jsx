// --- IMPORTS ---
import { useEffect, useState } from 'react';
import { storageService } from '../services';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'rounded-full object-cover bg-surface border border-surface-border shrink-0 overflow-hidden select-none';

const SIZE_STYLE = {
    small:      'h-5 w-5 text-xs',
    medium:     'h-7 w-7 text-xs',
    large:      'h-9 w-9 text-sm',
    extraLarge: 'h-12 w-12 text-base',
};

const FALLBACK_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%239ca3af"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';


// --- HELPERS ---
export function resolveUserAvatar(user, currentUser = null) {
    if (!user) return null;
    if (typeof user === 'string') return user;

    const targetId = user.id || user.userId;
    const isCurrentUser = Boolean(targetId && currentUser?.id && targetId === currentUser.id);

    // 1. Resolve avatar preference (local override, user's saved setting, or default SYSTEM)
    const avatarPref = (typeof localStorage !== 'undefined' && targetId
        ? localStorage.getItem(`pamantasan_avatar_source_${targetId}`)
        : null) ?? user.userSettings?.avatar ?? (isCurrentUser ? currentUser?.userSettings?.avatar : null) ?? 'SYSTEM';

    // 2. Resolve Google photo URL (local cache, user property, or current user property)
    const googlePhoto = (typeof localStorage !== 'undefined' && targetId
        ? localStorage.getItem(`pamantasan_google_photo_url_${targetId}`)
        : null) ?? user.googlePhotoUrl ?? (isCurrentUser ? currentUser?.googlePhotoUrl : null);

    if (avatarPref === 'GOOGLE' && googlePhoto) {
        return googlePhoto;
    }

    return user.avatarPath ?? user.avatar ?? null;
}


// --- COMPONENTS ---
const Avatar = ({
    size = 'medium',
    src = null,
    user = null,
    alt = '',
    className,
    ...props
}) => {
    // REACTIVE LISTENER FOR AVATAR SWITCHES
    const [avatarVersion, setAvatarVersion] = useState(0);
    useEffect(() => {
        const handler = () => setAvatarVersion((v) => v + 1);
        window.addEventListener('pamantasan-avatar-changed', handler);
        return () => window.removeEventListener('pamantasan-avatar-changed', handler);
    }, []);

    // RESOLVE EFFECTIVE SOURCE
    const effectiveTargetSrc = user ? resolveUserAvatar(user) : src;

    const isDirectUrl = Boolean(
        effectiveTargetSrc &&
        (effectiveTargetSrc.startsWith('http://') ||
         effectiveTargetSrc.startsWith('https://') ||
         effectiveTargetSrc.startsWith('data:') ||
         effectiveTargetSrc.startsWith('blob:'))
    );

    const isPlaceholderPath = !effectiveTargetSrc ||
        effectiveTargetSrc === 'avatars/placeholder.png' ||
        effectiveTargetSrc === '/avatars/placeholder.png' ||
        effectiveTargetSrc === 'placeholder.png' ||
        effectiveTargetSrc === '/placeholder.png' ||
        effectiveTargetSrc === 'avatars/defaultAvatar.png' ||
        effectiveTargetSrc === '/avatars/defaultAvatar.png';

    const [resolvedUrl, setResolvedUrl] = useState(isDirectUrl ? effectiveTargetSrc : null);
    const [hasLoadError, setHasLoadError] = useState(false);

    // HOOKS
    useEffect(() => {
        let isCancelled = false;

        if (isDirectUrl) {
            setResolvedUrl(effectiveTargetSrc);
            setHasLoadError(false);
            return;
        }

        if (!isPlaceholderPath && effectiveTargetSrc) {
            storageService
                .getFileDownloadUrl(effectiveTargetSrc)
                .then((downloadUrl) => {
                    if (!isCancelled) {
                        if (downloadUrl) {
                            setResolvedUrl(downloadUrl);
                            setHasLoadError(false);
                        } else {
                            // If user custom avatar not found, fallback to cloud default placeholder
                            storageService.getDefaultAvatarUrl().then((defaultUrl) => {
                                if (!isCancelled && defaultUrl) {
                                    setResolvedUrl(defaultUrl);
                                }
                            });
                        }
                    }
                })
                .catch(() => {
                    if (!isCancelled) {
                        storageService.getDefaultAvatarUrl().then((defaultUrl) => {
                            if (!isCancelled && defaultUrl) {
                                setResolvedUrl(defaultUrl);
                            }
                        });
                    }
                });
        } else {
            storageService
                .getDefaultAvatarUrl()
                .then((defaultUrl) => {
                    if (!isCancelled && defaultUrl) {
                        setResolvedUrl(defaultUrl);
                        setHasLoadError(false);
                    }
                })
                .catch(() => {});
        }

        return () => {
            isCancelled = true;
        };
    }, [effectiveTargetSrc, isDirectUrl, isPlaceholderPath, avatarVersion]);

    // HANDLERS
    const handleImageError = () => {
        if (!hasLoadError) {
            setHasLoadError(true);
            storageService.getDefaultAvatarUrl().then((defaultUrl) => {
                if (defaultUrl && defaultUrl !== resolvedUrl) {
                    setResolvedUrl(defaultUrl);
                    setHasLoadError(false);
                }
            }).catch(() => {});
        }
    };

    // DERIVED VALUES
    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.medium;
    const composedClassName = `${BASE_STYLE} ${sizeStyle} ${className ?? ''}`.trim();
    const effectiveAlt = alt || 'User avatar';
    const effectiveSource = (!hasLoadError && resolvedUrl) ? resolvedUrl : FALLBACK_AVATAR;

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
export default Avatar;
