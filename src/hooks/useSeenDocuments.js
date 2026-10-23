// --- IMPORTS ---
import { useState, useCallback } from 'react';
import { constants } from '../constants';

// --- CONFIGURATIONS ---
const SEEN_STORAGE_KEY_PREFIX = 'pamantasan_seen_items_';
const MAX_STORED_SEEN_ITEMS = 1000;
const RECENCY_THRESHOLD_DAYS = 14;

const cleanId = (uid) => {
    if (!uid) return '';
    return typeof uid === 'string' ? uid.replace(/-/g, '').toLowerCase() : String(uid).toLowerCase();
};

/**
 * Generate a unique activity state fingerprint for an item.
 * When an item transitions state (e.g. uploaded -> shared -> approved -> published, or request updated),
 * its fingerprint changes, making it eligible for highlight again to the next relevant role.
 */
export const getItemFingerprint = (item, resourceName = 'documents') => {
    if (!item?.id) return null;
    const itemId = cleanId(item.id);
    const status = String(item.status || item.share?.status || 'ACTIVE').toUpperCase();
    const version = item.version || 'v1';
    const timestamp = item.rawDate || item.updatedAt || item.createdAt || '';
    return `${resourceName}#${itemId}#${status}#${version}#${timestamp}`;
};

/**
 * Check if the item was created or updated within the recency window.
 */
export const isItemRecent = (item, daysThreshold = RECENCY_THRESHOLD_DAYS) => {
    const rawDate = item.rawDate || item.updatedAt || item.createdAt;
    if (!rawDate) return false;
    const itemTime = new Date(rawDate).getTime();
    if (isNaN(itemTime)) return false;
    const cutoff = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;
    return itemTime >= cutoff;
};

/**
 * Determine if an item is considered new and should be highlighted for the current user.
 * Excludes the actor who performed the action (uploader, sharer, creator, requester, etc.).
 */
export const isItemNewForUser = (item, currentUser, seenSet, resourceName = 'documents') => {
    if (!item?.id || !currentUser?.id) return false;

    // 1. Must be within the recency threshold
    if (!isItemRecent(item)) return false;

    // 2. If user already hovered/seen this state fingerprint, do not highlight
    const fingerprint = getItemFingerprint(item, resourceName);
    if (!fingerprint || seenSet.has(fingerprint)) return false;

    const currentUserIdClean = cleanId(currentUser.id);
    const userRole = currentUser.role;

    // 3. Resource-specific actor exclusion & workflow validation
    if (resourceName === 'users') {
        // Exclude the user themselves
        if (cleanId(item.id) === currentUserIdClean) return false;
        if (item.universityId && currentUser.universityId && cleanId(item.universityId) === cleanId(currentUser.universityId)) return false;
        // Exclude the admin/staff who registered this user
        const creatorClean = cleanId(item.createdBy || item.createdById || item.creatorId);
        if (creatorClean && creatorClean === currentUserIdClean) return false;
        return true;
    }

    if (resourceName === 'departments') {
        // Exclude the admin who created the department
        const creatorClean = cleanId(item.createdBy || item.createdById || item.creatorId);
        if (creatorClean && creatorClean === currentUserIdClean) return false;
        return true;
    }

    if (resourceName === 'document_requests' || resourceName === 'requests') {
        const requesterClean = cleanId(item.requesterId || item.requester?.id || item.requester);
        const isRequester = requesterClean === currentUserIdClean;
        const statusUpper = String(item.status || 'OPEN').toUpperCase();

        if (statusUpper === 'OPEN' || statusUpper === constants.DOCUMENT_REQUESTS_STATUS.OPEN) {
            // Requester already knows they requested it; reviewers/staff should see it highlighted
            return !isRequester;
        }
        if (statusUpper === constants.DOCUMENT_REQUESTS_STATUS.RESOLVED || statusUpper === constants.DOCUMENT_REQUESTS_STATUS.REJECTED) {
            // Requester should see the resolution/update highlighted
            return isRequester;
        }
        return !isRequester;
    }

    if (resourceName === 'coordinator_requests') {
        const requesterClean = cleanId(item.requesterId || item.requester?.id || item.requester || item.userId);
        const isRequester = requesterClean === currentUserIdClean;
        const statusUpper = String(item.status || 'PENDING').toUpperCase();

        if (statusUpper === 'PENDING' || statusUpper === constants.COORDINATOR_REQUESTS_STATUS.PENDING) {
            // Requester knows they requested it; reviewer/coordinator/admin sees it highlighted
            return !isRequester;
        }
        if (
            statusUpper === constants.COORDINATOR_REQUESTS_STATUS.RESOLVED ||
            statusUpper === constants.COORDINATOR_REQUESTS_STATUS.APPROVED ||
            statusUpper === constants.COORDINATOR_REQUESTS_STATUS.REJECTED
        ) {
            // Requester sees the resolution highlighted
            return isRequester;
        }
        return !isRequester;
    }

    if (resourceName === 'archives') {
        // Exclude the user who archived or stashed the document
        const archiverClean = cleanId(item.archivedBy || item.uploaderId || item.uploader?.id);
        if (archiverClean && archiverClean === currentUserIdClean) return false;
        return true;
    }

    // Default: 'documents' resource workflow
    const uploaderClean = cleanId(
        item.uploaderId ||
        item.uploader?.id ||
        item.uploader ||
        item.createdBy ||
        item.createdById
    );
    // Allow the uploader to see the highlight accent tint on their uploaded/modified items until seen
    if (uploaderClean && uploaderClean === currentUserIdClean) {
        return true;
    }

    const share = item.share;
    const shareStatus = String(item.status || share?.status || '').toUpperCase();

    // STAFF (Administrator / Coordinator)
    if (constants.isStaffRole(userRole)) {
        return true;
    }

    // DEPARTMENT OFFICER
    if (constants.isOfficerRole(userRole)) {
        const sharerClean = cleanId(share?.sharerId || share?.sharer?.id);
        const approverClean = cleanId(item.approverId || share?.approverId || item.reviewerId || share?.reviewerId);
        if (sharerClean && sharerClean === currentUserIdClean) {
            return false;
        }
        if (approverClean && approverClean === currentUserIdClean) {
            return false;
        }
        // Officer only needs highlight on items waiting for their approval
        return shareStatus === constants.DOCUMENT_SHARES_STATUS.PENDING_APPROVAL;
    }

    // DEPARTMENT DIRECTOR
    if (constants.isDirectorRole(userRole)) {
        const publisherClean = cleanId(
            item.publisherId ||
            share?.publisherId ||
            item.publisher?.id ||
            share?.publisher?.id ||
            item.approverId ||
            share?.approverId ||
            item.reviewerId ||
            share?.reviewerId
        );
        if (publisherClean && publisherClean === currentUserIdClean) {
            return false;
        }
        // When published, department faculty members are notified; Director does not see highlight pulse
        if (shareStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED) {
            return false;
        }
        return shareStatus === constants.DOCUMENT_SHARES_STATUS.APPROVED;
    }

    // FACULTY / MEMBER
    if (constants.isMemberRole(userRole)) {
        const recClean = cleanId(share?.recipientId || share?.recipient?.id);
        const matchesRecipient = !recClean || recClean === currentUserIdClean;
        return shareStatus === constants.DOCUMENT_SHARES_STATUS.PUBLISHED && matchesRecipient;
    }

    return true;
};

const loadSeenSetFromStorage = (key) => {
    if (!key || typeof window === 'undefined') {
        return new Set();
    }
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return new Set(parsed);
            }
        }
    } catch {
        // Ignore parse errors
    }
    return new Set();
};

/**
 * Universal hook to manage seen item state across resources (documents, users, departments, requests, archives).
 */
export const useSeenItems = (resourceName = 'documents', currentUser) => {
    const activeUserId = currentUser?.id ? cleanId(currentUser.id) : null;
    const storageKey = activeUserId ? `${SEEN_STORAGE_KEY_PREFIX}${activeUserId}` : null;

    const [prevStorageKey, setPrevStorageKey] = useState(storageKey);
    const [seenSet, setSeenSet] = useState(() => loadSeenSetFromStorage(storageKey));

    if (prevStorageKey !== storageKey) {
        setPrevStorageKey(storageKey);
        setSeenSet(loadSeenSetFromStorage(storageKey));
    }

    // Mark an item or multiple items as seen (via hover, selection, ticking checkbox, or select all)
    const markItemAsSeen = useCallback(
        (target) => {
            if (!target || !storageKey) return;
            const items = Array.isArray(target) ? target : [target];
            if (items.length === 0) return;

            const fingerprints = [];
            for (const item of items) {
                const fp = getItemFingerprint(item, resourceName);
                if (fp) fingerprints.push(fp);
            }
            if (fingerprints.length === 0) return;

            setSeenSet((prev) => {
                let hasNew = false;
                for (const fp of fingerprints) {
                    if (!prev.has(fp)) {
                        hasNew = true;
                        break;
                    }
                }
                if (!hasNew) return prev;

                const next = new Set(prev);
                for (const fp of fingerprints) {
                    next.add(fp);
                }

                try {
                    const storedArray = Array.from(next);
                    const trimmed =
                        storedArray.length > MAX_STORED_SEEN_ITEMS
                            ? storedArray.slice(storedArray.length - MAX_STORED_SEEN_ITEMS)
                            : storedArray;
                    localStorage.setItem(storageKey, JSON.stringify(trimmed));
                } catch {
                    // Ignore quota or write failures
                }
                return next;
            });
        },
        [storageKey, resourceName]
    );

    // Filter a list of items to calculate highlighted item IDs
    const getHighlightedIds = useCallback(
        (items) => {
            if (!Array.isArray(items) || items.length === 0 || !currentUser) {
                return new Set();
            }
            const highlighted = new Set();
            for (const item of items) {
                if (isItemNewForUser(item, currentUser, seenSet, resourceName)) {
                    highlighted.add(item.id);
                }
            }
            return highlighted;
        },
        [currentUser, seenSet, resourceName]
    );

    return {
        seenSet,
        markItemAsSeen,
        markItemsAsSeen: markItemAsSeen,
        getHighlightedIds,
    };
};

/**
 * Backward compatibility alias for document-specific usage.
 */
export const useSeenDocuments = (currentUser) => useSeenItems('documents', currentUser);

