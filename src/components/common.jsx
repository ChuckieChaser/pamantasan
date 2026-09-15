// --- IMPORTS ---
import { cloneElement, isValidElement } from 'react';


// --- HELPERS ---
const renderIcon = (icon, iconStyle) => {
    if (!icon) {
        return null;
    }

    if (isValidElement(icon)) {
        const iconClassName = `${iconStyle} ${icon.props.className ?? ''}`.trim();
        return cloneElement(icon, { className: iconClassName });
    }

    const IconComponent = icon;
    return <IconComponent className={iconStyle} />;
};


// --- EXPORTS ---
export { renderIcon };

