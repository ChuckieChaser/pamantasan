// --- IMPORTS ---
import { useState, useEffect } from 'react';


// --- CONFIGURATIONS ---
const DEFAULT_DROPDOWN_HEIGHT = 240;
const DEFAULT_DROPDOWN_WIDTH = 320;


// --- HOOK ---
const useSmartPosition = (triggerRef, dropdownRef, isOpen, preferredHorizontal = 'auto') => {
    // STATES
    const [placement, setPlacement] = useState({
        vertical: 'bottom',
        horizontal: preferredHorizontal === 'right' ? 'right' : 'left',
    });

    // LISTENERS
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const updatePosition = () => {
            if (!triggerRef?.current) {
                return;
            }

            const triggerRect = triggerRef.current.getBoundingClientRect();
            const dropdown = dropdownRef?.current;
            const dropdownHeight = dropdown?.offsetHeight ?? DEFAULT_DROPDOWN_HEIGHT;
            const dropdownWidth = dropdown?.offsetWidth ?? DEFAULT_DROPDOWN_WIDTH;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            const spaceBelow = viewportHeight - triggerRect.bottom;
            const spaceAbove = triggerRect.top;
            const spaceRight = viewportWidth - triggerRect.left;
            const spaceLeft = triggerRect.right;

            const vertical = spaceBelow < dropdownHeight && spaceAbove > spaceBelow
                ? 'top'
                : 'bottom';

            let horizontal;

            if (preferredHorizontal === 'right') {
                horizontal = spaceLeft >= dropdownWidth || spaceLeft > spaceRight
                    ? 'right'
                    : 'left';
            } else if (preferredHorizontal === 'left') {
                horizontal = spaceRight >= dropdownWidth || spaceRight > spaceLeft
                    ? 'left'
                    : 'right';
            } else {
                const isRightHalf = triggerRect.left + triggerRect.width / 2 > viewportWidth / 2;

                if (isRightHalf) {
                    horizontal = spaceLeft >= dropdownWidth || spaceLeft > spaceRight
                        ? 'right'
                        : 'left';
                } else {
                    horizontal = spaceRight < dropdownWidth && spaceLeft >= dropdownWidth
                        ? 'right'
                        : 'left';
                }
            }

            setPlacement({ vertical, horizontal });
        };

        updatePosition();
        const frameId = requestAnimationFrame(updatePosition);

        window.addEventListener('resize', updatePosition, { passive: true });
        window.addEventListener('scroll', updatePosition, { capture: true, passive: true });

        return () => {
            cancelAnimationFrame(frameId);
            
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [triggerRef, dropdownRef, isOpen, preferredHorizontal]);

    return placement;
};


// --- EXPORTS ---
export { useSmartPosition };
