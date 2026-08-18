// --- IMPORTS ---
import { useState, useEffect } from 'react';

// --- HOOKS ---
function useSmartPosition(triggerReference, dropdownReference, isOpen) {
    const [placement, setPlacement] = useState('bottom');

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const updatePosition = () => {
            if (!triggerReference.current) {
                return;
            }

            const triggerRectangle = triggerReference.current.getBoundingClientRect();
            const dropdownHeight = dropdownReference?.current?.offsetHeight ?? 200;
            const viewportHeight = window.innerHeight;

            const spaceBelow = viewportHeight - triggerRectangle.bottom;
            const spaceAbove = triggerRectangle.top;

            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                setPlacement('top');
            } else {
                setPlacement('bottom');
            }
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [triggerReference, dropdownReference, isOpen]);

    return placement;
}

export default useSmartPosition;
