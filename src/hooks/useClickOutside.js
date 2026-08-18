// --- IMPORTS ---
import { useEffect } from 'react';

// --- HOOKS ---
function useClickOutside(elementReference, onOutsideClick) {
    useEffect(() => {
        const handleDocumentClick = (event) => {
            if (!elementReference.current) {
                return;
            }

            if (elementReference.current.contains(event.target)) {
                return;
            }

            onOutsideClick?.(event);
        };

        document.addEventListener('mousedown', handleDocumentClick);
        document.addEventListener('touchstart', handleDocumentClick);

        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
            document.removeEventListener('touchstart', handleDocumentClick);
        };
    }, [elementReference, onOutsideClick]);
}

export default useClickOutside;
