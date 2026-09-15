// --- IMPORTS ---
import { renderIcon } from './common';


// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-4 w-4 shrink-0';

const NAVIGATION_CONTAINER_STYLE = 'flex flex-col gap-2';
const NAVIGATION_ICON_STYLE = 'h-5 w-5 shrink-0';
const NAVIGATION_ITEM_BASE_STYLE = 'h-9 w-9 inline-flex items-center justify-center rounded-md border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const NAVIGATION_ITEM_STATE_STYLE = {
    active:   'bg-accent text-text-inverted border-accent hover:bg-accent-hover',
    inactive: 'bg-surface text-text-muted border-surface-border hover:text-text hover:bg-surface-hover',
};

const TOGGLE_BASE_STYLE = 'h-7 w-7 inline-flex items-center justify-center rounded-md border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const TOGGLE_STATE_STYLE = {
    active:   'bg-accent-background text-accent border-accent-border hover:bg-accent-background',
    inactive: 'bg-transparent text-text-muted border-transparent hover:text-text hover:bg-surface-hover hover:border-surface-border',
};

const SEGMENT_CONTAINER_STYLE = 'h-9 inline-flex items-center p-1 bg-surface border border-surface-border rounded-md gap-1 box-border';
const SEGMENT_ITEM_BASE_STYLE = 'h-7 px-2 text-xs font-medium rounded-sm inline-flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const SEGMENT_ITEM_STATE_STYLE = {
    active:   'bg-accent text-text-inverted',
    inactive: 'text-text-muted hover:text-text hover:bg-surface-hover',
};

const VIEW_CONTAINER_STYLE = 'h-9 inline-flex items-center';
const VIEW_ITEM_BASE_STYLE = 'h-9 w-9 inline-flex items-center justify-center border border-surface-border transition-colors cursor-pointer first:rounded-l-md last:rounded-r-md -ml-px first:ml-0 disabled:cursor-not-allowed disabled:opacity-50';
const VIEW_ITEM_STATE_STYLE = {
    active:   'bg-accent text-text-inverted border-accent z-10 hover:bg-accent-hover',
    inactive: 'bg-surface text-text hover:bg-surface-hover hover:text-text z-0',
};

const SWITCH_CONTAINER_STYLE = 'flex flex-col gap-2';
const SWITCH_ROW_STYLE = 'h-9 inline-flex items-center gap-3 cursor-pointer select-none';
const SWITCH_TRACK_BASE_STYLE = 'h-5 w-9 inline-flex items-center rounded-full p-1 transition-colors cursor-pointer border disabled:cursor-not-allowed disabled:opacity-50';
const SWITCH_TRACK_STATE_STYLE = {
    active:   'bg-accent border-accent',
    inactive: 'bg-surface-hover border-surface-border',
};
const SWITCH_THUMB_BASE_STYLE = 'h-3 w-3 rounded-full bg-text-inverted transition-transform shadow-xs pointer-events-none';
const SWITCH_THUMB_STATE_STYLE = {
    active:   'translate-x-4',
    inactive: 'translate-x-0',
};


// --- COMPONENTS ---
const NavigationSelection = ({
    value,
    options = [],
    isDisabled = false,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleChange = (optionValue) => {
        if (isDisabled) {
            return;
        }

        onChange?.(optionValue);
    };

    // DERIVED VALUES
    const composedContainerClassName = `${NAVIGATION_CONTAINER_STYLE} ${className ?? ''}`.trim();

    // RENDER
    return (
        <nav
            className={composedContainerClassName}
            {...props}
        >
            {options.map((option) => {
                const isActive = option.value === value;
                const isOptionDisabled = isDisabled || option.isDisabled || option.disabled;
                const stateStyle = isActive
                    ? NAVIGATION_ITEM_STATE_STYLE.active
                    : NAVIGATION_ITEM_STATE_STYLE.inactive;
                const itemClassName = `${NAVIGATION_ITEM_BASE_STYLE} ${stateStyle}`.trim();

                const renderedIcon = renderIcon(option.icon, NAVIGATION_ICON_STYLE);

                return (
                    <button
                        key={option.value}
                        type="button"
                        disabled={isOptionDisabled}
                        title={option.title ?? option.label}
                        aria-label={option.title ?? option.label}
                        onClick={() => handleChange(option.value)}
                        className={itemClassName}
                    >
                        {renderedIcon}
                    </button>
                );
            })}
        </nav>
    );
};

const ToggleSelection = ({
    isPressed = false,
    pressed,
    icon,
    isDisabled = false,
    onChange,
    className,
    ...props
}) => {
    const effectivePressed = Boolean(pressed !== undefined ? pressed : isPressed);

    // HANDLERS
    const handleClick = (event) => {
        if (isDisabled) {
            return;
        }

        onChange?.(!effectivePressed, event);
    };
    const stateStyle = effectivePressed
        ? TOGGLE_STATE_STYLE.active
        : TOGGLE_STATE_STYLE.inactive;
    const composedClassName = `${TOGGLE_BASE_STYLE} ${stateStyle} ${className ?? ''}`.trim();
    const renderedIcon = renderIcon(icon, ICON_STYLE);

    // RENDER
    return (
        <button
            type="button"
            disabled={isDisabled}
            aria-pressed={effectivePressed}
            onClick={handleClick}
            className={composedClassName}
            {...props}
        >
            {renderedIcon}
        </button>
    );
};

const SegmentSelection = ({
    value,
    options = [],
    isDisabled = false,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleChange = (optionValue) => {
        if (isDisabled) {
            return;
        }

        onChange?.(optionValue);
    };

    // DERIVED VALUES
    const composedContainerClassName = `${SEGMENT_CONTAINER_STYLE} ${className ?? ''}`.trim();

    // RENDER
    return (
        <div
            role="radiogroup"
            className={composedContainerClassName}
            {...props}
        >
            {options.map((option) => {
                const isActive = option.value === value;
                const isOptionDisabled = isDisabled || option.isDisabled || option.disabled;
                const stateStyle = isActive
                    ? SEGMENT_ITEM_STATE_STYLE.active
                    : SEGMENT_ITEM_STATE_STYLE.inactive;
                const itemClassName = `${SEGMENT_ITEM_BASE_STYLE} ${stateStyle}`.trim();

                const renderedIcon = renderIcon(option.icon, ICON_STYLE);

                return (
                    <button
                        key={option.value}
                        type="button"
                        disabled={isOptionDisabled}
                        onClick={() => handleChange(option.value)}
                        className={itemClassName}
                    >
                        {renderedIcon}
                        {option.label && <span>{option.label}</span>}
                    </button>
                );
            })}
        </div>
    );
};

const ViewSelection = ({
    value,
    options = [],
    isDisabled = false,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleChange = (optionValue) => {
        if (isDisabled) {
            return;
        }

        onChange?.(optionValue);
    };

    // DERIVED VALUES
    const composedContainerClassName = `${VIEW_CONTAINER_STYLE} ${className ?? ''}`.trim();

    // RENDER
    return (
        <div
            role="group"
            className={composedContainerClassName}
            {...props}
        >
            {options.map((option) => {
                const isActive = option.value === value;
                const isOptionDisabled = isDisabled || option.isDisabled || option.disabled;
                const stateStyle = isActive
                    ? VIEW_ITEM_STATE_STYLE.active
                    : VIEW_ITEM_STATE_STYLE.inactive;
                const itemClassName = `${VIEW_ITEM_BASE_STYLE} ${stateStyle}`.trim();

                const renderedIcon = renderIcon(option.icon, ICON_STYLE);

                return (
                    <button
                        key={option.value}
                        type="button"
                        disabled={isOptionDisabled}
                        onClick={() => handleChange(option.value)}
                        className={itemClassName}
                        title={option.title ?? option.label}
                        aria-label={option.label ?? option.title}
                    >
                        {renderedIcon}
                    </button>
                );
            })}
        </div>
    );
};

const SwitchSelection = ({
    isChecked = false,
    value,
    label,
    options = [],
    isDisabled = false,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleToggle = (optionValue, currentCheckedState) => {
        if (isDisabled) {
            return;
        }

        onChange?.(optionValue, !currentCheckedState);
    };

    // RENDER
    if (options.length > 0) {
        const composedContainerClassName = `${SWITCH_CONTAINER_STYLE} ${className ?? ''}`.trim();

        return (
            <div
                className={composedContainerClassName}
                {...props}
            >
                {options.map((option) => {
                    const isOptionChecked = option.isChecked ?? option.checked ?? false;
                    const isOptionDisabled = isDisabled || option.isDisabled || option.disabled;
                    const trackStateStyle = isOptionChecked
                        ? SWITCH_TRACK_STATE_STYLE.active
                        : SWITCH_TRACK_STATE_STYLE.inactive;
                    const thumbStateStyle = isOptionChecked
                        ? SWITCH_THUMB_STATE_STYLE.active
                        : SWITCH_THUMB_STATE_STYLE.inactive;

                    const trackClassName = `${SWITCH_TRACK_BASE_STYLE} ${trackStateStyle}`.trim();
                    const thumbClassName = `${SWITCH_THUMB_BASE_STYLE} ${thumbStateStyle}`.trim();

                    return (
                        <label
                            key={option.value}
                            className={SWITCH_ROW_STYLE}
                        >
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isOptionChecked}
                                disabled={isOptionDisabled}
                                onClick={() => handleToggle(option.value, isOptionChecked)}
                                className={trackClassName}
                            >
                                <span className={thumbClassName} />
                            </button>
                            {option.label && (
                                <span className="text-sm font-medium text-text">{option.label}</span>
                            )}
                        </label>
                    );
                })}
            </div>
        );
    }

    const trackStateStyle = isChecked
        ? SWITCH_TRACK_STATE_STYLE.active
        : SWITCH_TRACK_STATE_STYLE.inactive;
    const thumbStateStyle = isChecked
        ? SWITCH_THUMB_STATE_STYLE.active
        : SWITCH_THUMB_STATE_STYLE.inactive;

    const trackClassName = `${SWITCH_TRACK_BASE_STYLE} ${trackStateStyle} ${className ?? ''}`.trim();
    const thumbClassName = `${SWITCH_THUMB_BASE_STYLE} ${thumbStateStyle}`.trim();

    return (
        <label
            className={SWITCH_ROW_STYLE}
            {...props}
        >
            <button
                type="button"
                role="switch"
                aria-checked={isChecked}
                disabled={isDisabled}
                onClick={() => handleToggle(value ?? '', isChecked)}
                className={trackClassName}
            >
                <span className={thumbClassName} />
            </button>
            {label && <span className="text-sm font-medium text-text">{label}</span>}
        </label>
    );
};


// --- EXPORTS ---
export {
    NavigationSelection,
    SegmentSelection,
    SwitchSelection,
    ToggleSelection,
    ViewSelection,
};
