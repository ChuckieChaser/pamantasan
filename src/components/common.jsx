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


const formatUniversityId = (value) => {
    if (!value) return '';
    const digits = String(value).replace(/\D/g, '').slice(0, 7);
    if (digits.length <= 2) {
        return digits;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 7)}`;
};


const formatDateTime = (dateInput) => {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '—';
    const datePart = d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const timePart = d.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    return `${datePart} at ${timePart}`;
};


// --- EXPORTS ---
export { renderIcon, formatUniversityId, formatDateTime };

