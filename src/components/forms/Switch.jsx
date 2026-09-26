// --- IMPORTS ---


// --- CONFIGURATIONS ---
const CONTAINER_STYLE = 'h-9 inline-flex items-center justify-between gap-3 select-none cursor-pointer touch-manipulation w-full';
const TRACK_BASE_STYLE = 'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const THUMB_BASE_STYLE = 'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out mt-[2px]';

const TRACK_STATE_STYLE = {
    active:   'bg-accent border-accent',
    inactive: 'bg-surface-hover border-surface-border',
};

const THUMB_STATE_STYLE = {
    active:   'translate-x-4',
    inactive: 'translate-x-0.5',
};


// --- COMPONENTS ---
export const Switch = ({
    id,
    name,
    isChecked = false,
    checked,
    onChange,
    label,
    description,
    isDisabled = false,
    className = '',
    ...props
}) => {
    // --- DERIVED VALUES ---
    const effectiveChecked = Boolean(checked !== undefined ? checked : isChecked);
    const trackState = effectiveChecked ? TRACK_STATE_STYLE.active : TRACK_STATE_STYLE.inactive;
    const thumbState = effectiveChecked ? THUMB_STATE_STYLE.active : THUMB_STATE_STYLE.inactive;
    const composedContainerClassName = `${CONTAINER_STYLE} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`.trim();

    // --- HANDLERS ---
    const handleToggle = (event) => {
        if (isDisabled) return;
        event.preventDefault();
        onChange?.(!effectiveChecked);
    };

    // --- RENDER ---
    return (
        <label
            htmlFor={id}
            onClick={handleToggle}
            className={composedContainerClassName}
            {...props}
        >
            <div className="flex flex-col min-w-0 pr-2">
                {label && (
                    <span className="text-sm font-medium text-text truncate">
                        {label}
                    </span>
                )}
                {description && (
                    <span className="text-xs text-text-muted truncate">
                        {description}
                    </span>
                )}
            </div>

            <button
                id={id}
                name={name}
                type="button"
                role="switch"
                aria-checked={effectiveChecked}
                disabled={isDisabled}
                className={`${TRACK_BASE_STYLE} ${trackState}`}
            >
                <span className={`${THUMB_BASE_STYLE} ${thumbState}`} />
            </button>
        </label>
    );
};
