/* eslint-disable react-refresh/only-export-components */
// --- IMPORTS ---
import { useEffect, useState } from 'react';
import { storageService } from '../services';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'rounded-full aspect-square object-cover bg-surface border border-surface-border shrink-0 overflow-hidden select-none';

const SIZE_STYLE = {
    small:      'h-5 w-5 text-xs',
    medium:     'h-7 w-7 text-xs',
    large:      'h-9 w-9 text-sm',
    extraLarge: 'h-12 w-12 text-base',
};

const isPlaceholder = (path) => {
    if (!path || typeof path !== 'string') return true;
    const trimmed = path.trim().toLowerCase();
    return (
        trimmed === '' ||
        trimmed === 'avatars/placeholder.png' ||
        trimmed === '/avatars/placeholder.png' ||
        trimmed === 'placeholder.png' ||
        trimmed === '/placeholder.png' ||
        trimmed === 'avatars/defaultavatar.png' ||
        trimmed === '/avatars/defaultavatar.png' ||
        trimmed === 'null' ||
        trimmed === 'undefined'
    );
};

// --- HELPERS ---
export function resolveUserAvatar(user, currentUser = null) {
    if (!user) return null;
    if (typeof user === 'string') {
        return isPlaceholder(user) ? null : user;
    }

    const targetId = user.id || user.userId || user.uid;
    const currentId = currentUser?.id || currentUser?.userId || currentUser?.uid;
    const isCurrentUser = Boolean(targetId && currentId && targetId === currentId);

    // 1. Resolve avatar preference (local override, user's saved setting, or default SYSTEM)
    const avatarPref = (typeof localStorage !== 'undefined' && targetId
        ? localStorage.getItem(`pamantasan_avatar_source_${targetId}`)
        : null) ?? user.userSettings?.avatar ?? (isCurrentUser ? currentUser?.userSettings?.avatar : null) ?? 'SYSTEM';

    // 2. Resolve Google photo URL (local cache, user property, or current user property)
    const googlePhoto = (typeof localStorage !== 'undefined' && targetId
        ? localStorage.getItem(`pamantasan_google_photo_url_${targetId}`)
        : null) ?? user.googlePhotoUrl ?? user.photoURL ?? (isCurrentUser ? (currentUser?.googlePhotoUrl || currentUser?.photoURL) : null);

    if (avatarPref === 'GOOGLE' && googlePhoto) {
        return googlePhoto;
    }

    // Direct HTTP/HTTPS URL from database or auth (e.g., Google Profile avatar)
    if (user.avatarPath && (user.avatarPath.startsWith('http://') || user.avatarPath.startsWith('https://'))) {
        return user.avatarPath;
    }
    if (user.photoURL && (user.photoURL.startsWith('http://') || user.photoURL.startsWith('https://'))) {
        return user.photoURL;
    }

    // Custom uploaded avatar in storage
    if (user.avatarPath && !isPlaceholder(user.avatarPath)) {
        return user.avatarPath;
    }

    // If Google photo is available, use it before giving up
    if (googlePhoto) {
        return googlePhoto;
    }

    if (user.avatar && !isPlaceholder(user.avatar)) {
        return user.avatar;
    }

    return null;
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
    const effectiveTargetSrc = user ? (resolveUserAvatar(user, user) || src) : src;

    const isDirectUrl = Boolean(
        effectiveTargetSrc &&
        (effectiveTargetSrc.startsWith('http://') ||
         effectiveTargetSrc.startsWith('https://') ||
         effectiveTargetSrc.startsWith('data:') ||
         effectiveTargetSrc.startsWith('blob:'))
    );

    const isPlaceholderSrc = isPlaceholder(effectiveTargetSrc);

    const [resolvedUrl, setResolvedUrl] = useState(null);
    const [failedSrcs, setFailedSrcs] = useState({});

    // HOOKS
    useEffect(() => {
        let isCancelled = false;

        if (isDirectUrl || isPlaceholderSrc || !effectiveTargetSrc) {
            return;
        }

        storageService
            .getFileDownloadUrl(effectiveTargetSrc)
            .then((downloadUrl) => {
                if (!isCancelled) {
                    setResolvedUrl(downloadUrl || null);
                }
            })
            .catch(() => {
                if (!isCancelled) {
                    setResolvedUrl(null);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [effectiveTargetSrc, isDirectUrl, isPlaceholderSrc, avatarVersion]);

    // DERIVED ACTIVE SOURCE
    const activeResolved = isDirectUrl ? effectiveTargetSrc : resolvedUrl;
    const hasLoadError = Boolean(activeResolved && failedSrcs[activeResolved]);

    // HANDLERS
    const handleImageError = () => {
        if (activeResolved) {
            setFailedSrcs((prev) => ({ ...prev, [activeResolved]: true }));
        }
    };

    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return '';
        const clean = name.replace(/[^a-zA-Z\s]/g, '').trim();
        if (!clean) return '';
        const parts = clean.split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const sizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.medium;
    const composedClassName = `${BASE_STYLE} ${sizeStyle} ${className ?? ''}`.trim();
    const userFullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
    const effectiveAlt = alt || userFullName || 'User avatar';
    const initials = getInitials(effectiveAlt !== 'User avatar' && effectiveAlt !== 'You' ? effectiveAlt : userFullName);

    // If load error occurred or no active image URL is resolved, render clean fallback (prevents broken image icon)
    if (hasLoadError || !activeResolved) {
        return (
            <div
                className={`${composedClassName} flex items-center justify-center bg-accent/15 text-accent font-semibold select-none`}
                title={effectiveAlt}
                {...props}
            >
                {initials ? (
                    <span className="text-[0.65em] font-bold text-accent uppercase tracking-wider">{initials}</span>
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-3/5 h-3/5 text-accent/80"
                    >
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                )}
            </div>
        );
    }

    // RENDER IMAGE WITH NO-REFERRER (CRUCIAL FOR GOOGLE/FIREBASE USER AVATARS)
    return (
        <img
            key={activeResolved}
            src={activeResolved}
            alt={effectiveAlt}
            referrerPolicy="no-referrer"
            onError={handleImageError}
            className={composedClassName}
            {...props}
        />
    );
};


// --- EXPORTS ---
export { Avatar };
export default Avatar;
