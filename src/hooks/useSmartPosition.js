// --- IMPORTS ---
import { useState, useEffect } from 'react';

// --- HOOKS ---
function useSmartPosition(
    triggerReference,
    dropdownReference,
    isOpen,
    preferredHorizontal = 'auto',
) {
    const [placement, setPlacement] = useState({
        vertical: 'bottom',
        horizontal: preferredHorizontal === 'right' ? 'right' : 'left',
    });

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const updatePosition = () => {
            if (!triggerReference.current) {
                return;
            }

            const triggerRectangle = triggerReference.current.getBoundingClientRect();
            const dropdownElement = dropdownReference?.current;
            const dropdownHeight = dropdownElement?.offsetHeight ?? 240;
            const dropdownWidth = dropdownElement?.offsetWidth ?? 320;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            const spaceBelow = viewportHeight - triggerRectangle.bottom;
            const spaceAbove = triggerRectangle.top;
            const spaceRight = viewportWidth - triggerRectangle.left;
            const spaceLeft = triggerRectangle.right;

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
                const isRightHalf = triggerRectangle.left + triggerRectangle.width / 2 > viewportWidth / 2;
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
        const animationFrameIdentifier = requestAnimationFrame(updatePosition);

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            cancelAnimationFrame(animationFrameIdentifier);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [triggerReference, dropdownReference, isOpen, preferredHorizontal]);

    return placement;
}

export default useSmartPosition;

