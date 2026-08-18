// --- IMPORTS ---
import { useState, useRef, cloneElement, isValidElement } from 'react';
import { Search, Eye, EyeOff, ChevronDown, Check, X } from 'lucide-react';
import { DropdownContainer } from './Container';
import useClickOutside from '../hooks/useClickOutside';
import useSmartPosition from '../hooks/useSmartPosition';

// --- CONFIGURATIONS ---
const ICON_STYLE = 'h-4 w-4 shrink-0';

const FIELD_WRAPPER_STYLE = 'flex flex-col gap-1 w-full';
const FIELD_LABEL_STYLE = 'text-xs font-medium text-text';
const FIELD_HELPER_STYLE = 'text-xs text-text-muted';
const FIELD_ERROR_STYLE = 'text-xs text-error';

const CONTROL_BASE_STYLE =
    'h-8 px-3 text-sm rounded-md border bg-surface hover:bg-surface-hover focus-within:bg-surface text-text placeholder:text-text-muted transition-colors inline-flex items-center gap-2 w-full disabled:cursor-not-allowed disabled:opacity-50';

const CONTROL_STATE_STYLE = {
    default: 'border-surface-border focus-within:border-accent',
    error: 'border-error-border focus-within:border-error',
};

const AREA_WRAPPER_BASE_STYLE =
    'p-3 text-sm rounded-md border bg-surface hover:bg-surface-hover focus-within:bg-surface text-text placeholder:text-text-muted transition-colors w-full min-h-20 flex items-start gap-2 disabled:cursor-not-allowed disabled:opacity-50';

const DROPDOWN_POSITION_STYLE = {
    bottom: 'top-full mt-1',
    top: 'bottom-full mb-1',
};

// --- COMPONENTS ---

// 1. TEXT FIELD
const TextField = ({
    label,
    error,
    helperText,
    leadingIcon,
    trailingIcon,
    type = 'text',
    value,
    placeholder,
    disabled = false,
    readOnly = false,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleChange = (event) => {
        if (disabled || readOnly) {
            return;
        }

        onChange?.(event);
    };

    // STYLES
    const stateStyle = error
        ? CONTROL_STATE_STYLE.error
        : CONTROL_STATE_STYLE.default;
    const composedControlClassName = `${CONTROL_BASE_STYLE} ${stateStyle} ${className ?? ''}`.trim();

    // RENDER
    return (
        <div className={FIELD_WRAPPER_STYLE}>
            {label && <label className={FIELD_LABEL_STYLE}>{label}</label>}

            <div className={composedControlClassName}>
                {leadingIcon && (
                    <span className="text-text-muted shrink-0">
                        {renderIcon(leadingIcon)}
                    </span>
                )}
                <input
                    type={type}
                    value={value}
                    disabled={disabled}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    onChange={handleChange}
                    className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
                    {...props}
                />
                {trailingIcon && (
                    <span className="text-text-muted shrink-0">
                        {renderIcon(trailingIcon)}
                    </span>
                )}
            </div>

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && (
                <span className={FIELD_HELPER_STYLE}>{helperText}</span>
            )}
        </div>
    );
};

// 2. PASSWORD FIELD
const PasswordField = ({
    label,
    error,
    helperText,
    leadingIcon,
    trailingIcon,
    value,
    placeholder = 'Enter password...',
    disabled = false,
    readOnly = false,
    onChange,
    className,
    ...props
}) => {
    // STATES
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // HANDLERS
    const handleToggleVisibility = () => {
        if (disabled) {
            return;
        }

        setIsPasswordVisible((previousState) => !previousState);
    };

    const handleChange = (event) => {
        if (disabled || readOnly) {
            return;
        }

        onChange?.(event);
    };

    // STYLES
    const stateStyle = error
        ? CONTROL_STATE_STYLE.error
        : CONTROL_STATE_STYLE.default;
    const composedControlClassName = `${CONTROL_BASE_STYLE} ${stateStyle} ${className ?? ''}`.trim();

    // RENDER
    return (
        <div className={FIELD_WRAPPER_STYLE}>
            {label && <label className={FIELD_LABEL_STYLE}>{label}</label>}

            <div className={composedControlClassName}>
                {leadingIcon && (
                    <span className="text-text-muted shrink-0">
                        {renderIcon(leadingIcon)}
                    </span>
                )}
                <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={value}
                    disabled={disabled}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    onChange={handleChange}
                    className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
                    {...props}
                />
                {trailingIcon ? (
                    <span className="text-text-muted shrink-0">
                        {renderIcon(trailingIcon)}
                    </span>
                ) : (
                    <button
                        type="button"
                        tabIndex={-1}
                        disabled={disabled}
                        onClick={handleToggleVisibility}
                        className="text-text-muted hover:text-text transition-colors cursor-pointer shrink-0"
                        title={isPasswordVisible ? 'Hide password' : 'Show password'}
                    >
                        {isPasswordVisible ? (
                            <EyeOff className={ICON_STYLE} />
                        ) : (
                            <Eye className={ICON_STYLE} />
                        )}
                    </button>
                )}
            </div>

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && (
                <span className={FIELD_HELPER_STYLE}>{helperText}</span>
            )}
        </div>
    );
};

// 3. AREA FIELD (TEXTAREA)
const AreaField = ({
    label,
    error,
    helperText,
    leadingIcon,
    value,
    placeholder,
    rows = 3,
    disabled = false,
    readOnly = false,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleChange = (event) => {
        if (disabled || readOnly) {
            return;
        }

        onChange?.(event);
    };

    // STYLES
    const stateStyle = error
        ? CONTROL_STATE_STYLE.error
        : CONTROL_STATE_STYLE.default;
    const composedAreaClassName = `${AREA_WRAPPER_BASE_STYLE} ${stateStyle} ${className ?? ''}`.trim();

    // RENDER
    return (
        <div className={FIELD_WRAPPER_STYLE}>
            {label && <label className={FIELD_LABEL_STYLE}>{label}</label>}

            <div className={composedAreaClassName}>
                {leadingIcon && (
                    <span className="text-text-muted shrink-0 pt-1">
                        {renderIcon(leadingIcon)}
                    </span>
                )}

                <textarea
                    rows={rows}
                    value={value}
                    disabled={disabled}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    onChange={handleChange}
                    className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none resize-y border-none p-0 disabled:cursor-not-allowed"
                    {...props}
                />
            </div>

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && (
                <span className={FIELD_HELPER_STYLE}>{helperText}</span>
            )}
        </div>
    );
};

// 4. SEARCH FIELD
const SearchField = ({
    label,
    error,
    helperText,
    leadingIcon,
    trailingIcon,
    value,
    placeholder = 'Search...',
    disabled = false,
    onClear,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleChange = (event) => {
        if (disabled) {
            return;
        }

        onChange?.(event);
    };

    const handleClear = () => {
        if (disabled) {
            return;
        }

        onClear?.();
    };

    // STYLES
    const stateStyle = error
        ? CONTROL_STATE_STYLE.error
        : CONTROL_STATE_STYLE.default;
    const composedControlClassName = `${CONTROL_BASE_STYLE} ${stateStyle} ${className ?? ''}`.trim();

    // RENDER
    return (
        <div className={FIELD_WRAPPER_STYLE}>
            {label && <label className={FIELD_LABEL_STYLE}>{label}</label>}

            <div className={composedControlClassName}>
                <span className="text-text-muted shrink-0">
                    {leadingIcon ? renderIcon(leadingIcon) : <Search className={ICON_STYLE} />}
                </span>
                <input
                    type="text"
                    value={value}
                    disabled={disabled}
                    placeholder={placeholder}
                    onChange={handleChange}
                    className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
                    {...props}
                />
                {trailingIcon ? (
                    <span className="text-text-muted shrink-0">
                        {renderIcon(trailingIcon)}
                    </span>
                ) : value ? (
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={handleClear}
                        className="text-text-muted hover:text-text transition-colors cursor-pointer shrink-0"
                        title="Clear search"
                    >
                        <X className={ICON_STYLE} />
                    </button>
                ) : null}
            </div>

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && (
                <span className={FIELD_HELPER_STYLE}>{helperText}</span>
            )}
        </div>
    );
};

// 5. SELECT FIELD (SINGLE OPTION CUSTOM DROPDOWN)
const SelectField = ({
    label,
    value,
    options = [],
    placeholder = 'Select option...',
    leadingIcon,
    trailingIcon,
    disabled = false,
    error,
    helperText,
    onChange,
    className,
    ...props
}) => {
    // STATES
    const [isOpen, setIsOpen] = useState(false);

    // REFS
    const containerReference = useRef(null);
    const triggerReference = useRef(null);
    const dropdownReference = useRef(null);

    // HOOKS
    useClickOutside(containerReference, () => {
        setIsOpen(false);
    });

    const position = useSmartPosition(triggerReference, dropdownReference, isOpen);

    // HANDLERS
    const handleToggleOpen = () => {
        if (disabled) {
            return;
        }

        setIsOpen((previousState) => !previousState);
    };

    const handleSelectOption = (optionValue) => {
        if (disabled) {
            return;
        }

        onChange?.(optionValue);
        setIsOpen(false);
    };

    // STYLES
    const selectedOption = options.find((option) => option.value === value);
    const stateStyle = error
        ? CONTROL_STATE_STYLE.error
        : CONTROL_STATE_STYLE.default;
    const composedTriggerClassName = `${CONTROL_BASE_STYLE} ${stateStyle} justify-between cursor-pointer ${className ?? ''}`.trim();
    const positionStyle = DROPDOWN_POSITION_STYLE[position] ?? DROPDOWN_POSITION_STYLE.bottom;

    const displayLeadingIcon = leadingIcon ?? selectedOption?.icon;

    // RENDER
    return (
        <div
            ref={containerReference}
            className={`${FIELD_WRAPPER_STYLE} relative`}
            {...props}
        >
            {label && <label className={FIELD_LABEL_STYLE}>{label}</label>}

            <button
                ref={triggerReference}
                type="button"
                disabled={disabled}
                onClick={handleToggleOpen}
                className={composedTriggerClassName}
            >
                <span className="flex items-center gap-2 truncate">
                    {displayLeadingIcon && renderIcon(displayLeadingIcon)}
                    <span className={selectedOption ? 'text-text' : 'text-text-muted'}>
                        {selectedOption?.label ?? placeholder}
                    </span>
                </span>
                <span className="text-text-muted shrink-0">
                    {trailingIcon ? (
                        renderIcon(trailingIcon)
                    ) : (
                        <ChevronDown
                            className={`${ICON_STYLE} transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    )}
                </span>
            </button>

            {isOpen && (
                <div
                    ref={dropdownReference}
                    className={`absolute z-50 w-full left-0 ${positionStyle}`}
                >
                    <DropdownContainer className="max-h-60 overflow-y-auto">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            const itemClassName = isSelected
                                ? 'w-full flex items-center justify-between px-3 py-1.5 text-xs bg-accent text-white rounded transition-colors text-left cursor-pointer'
                                : 'w-full flex items-center justify-between px-3 py-1.5 text-xs text-text hover:bg-surface-hover rounded transition-colors text-left cursor-pointer';

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelectOption(option.value)}
                                    className={itemClassName}
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        {option.icon && renderIcon(option.icon)}
                                        <span>{option.label}</span>
                                    </span>
                                    {isSelected && <Check className={ICON_STYLE} />}
                                </button>
                            );
                        })}
                    </DropdownContainer>
                </div>
            )}

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && (
                <span className={FIELD_HELPER_STYLE}>{helperText}</span>
            )}
        </div>
    );
};

// 6. COMBO FIELD (MULTI OPTION FILTER DROPDOWN)
const ComboField = ({
    label,
    values = [],
    options = [],
    placeholder = 'Filter options...',
    leadingIcon,
    trailingIcon,
    disabled = false,
    error,
    helperText,
    onChange,
    className,
    ...props
}) => {
    // STATES
    const [isOpen, setIsOpen] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');

    // REFS
    const containerReference = useRef(null);
    const triggerReference = useRef(null);
    const dropdownReference = useRef(null);

    // HOOKS
    useClickOutside(containerReference, () => {
        setIsOpen(false);
    });

    const position = useSmartPosition(triggerReference, dropdownReference, isOpen);

    // HANDLERS
    const handleToggleOpen = () => {
        if (disabled) {
            return;
        }

        setIsOpen((previousState) => !previousState);
    };

    const handleFilterChange = (event) => {
        setFilterQuery(event.target.value);
    };

    const handleToggleOption = (optionValue) => {
        if (disabled) {
            return;
        }

        const isAlreadySelected = values.includes(optionValue);
        const updatedValues = isAlreadySelected
            ? values.filter((currentValue) => currentValue !== optionValue)
            : [...values, optionValue];

        onChange?.(updatedValues);
    };

    const handleClearAll = (event) => {
        event.stopPropagation();
        if (disabled) {
            return;
        }

        onChange?.([]);
    };

    // STYLES
    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(filterQuery.toLowerCase())
    );

    const stateStyle = error
        ? CONTROL_STATE_STYLE.error
        : CONTROL_STATE_STYLE.default;
    const composedTriggerClassName = `${CONTROL_BASE_STYLE} ${stateStyle} justify-between cursor-pointer ${className ?? ''}`.trim();
    const positionStyle = DROPDOWN_POSITION_STYLE[position] ?? DROPDOWN_POSITION_STYLE.bottom;

    // RENDER
    return (
        <div
            ref={containerReference}
            className={`${FIELD_WRAPPER_STYLE} relative`}
            {...props}
        >
            {label && <label className={FIELD_LABEL_STYLE}>{label}</label>}

            <button
                ref={triggerReference}
                type="button"
                disabled={disabled}
                onClick={handleToggleOpen}
                className={composedTriggerClassName}
            >
                <div className="flex items-center gap-1.5 truncate">
                    {leadingIcon && (
                        <span className="text-text-muted shrink-0">
                            {renderIcon(leadingIcon)}
                        </span>
                    )}
                    {values.length === 0 ? (
                        <span className="text-text-muted">{placeholder}</span>
                    ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-accent text-white font-medium">
                            {values.length} selected
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {values.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-text-muted hover:text-text transition-colors p-0.5 cursor-pointer"
                            title="Clear all"
                        >
                            <X className={ICON_STYLE} />
                        </button>
                    )}
                    <span className="text-text-muted shrink-0">
                        {trailingIcon ? (
                            renderIcon(trailingIcon)
                        ) : (
                            <ChevronDown
                                className={`${ICON_STYLE} transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                        )}
                    </span>
                </div>
            </button>

            {isOpen && (
                <div
                    ref={dropdownReference}
                    className={`absolute z-50 w-full left-0 ${positionStyle}`}
                >
                    <DropdownContainer className="max-h-72 overflow-hidden flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-2 py-1 bg-surface-hover rounded-md border border-surface-border">
                            <Search className={`${ICON_STYLE} text-text-muted`} />
                            <input
                                type="text"
                                value={filterQuery}
                                onChange={handleFilterChange}
                                placeholder="Type to filter..."
                                className="w-full bg-transparent text-xs text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none"
                            />
                        </div>

                        <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                            {filteredOptions.length === 0 ? (
                                <div className="p-2 text-xs text-text-muted text-center">
                                    No options match filter
                                </div>
                            ) : (
                                filteredOptions.map((option) => {
                                    const isSelected = values.includes(option.value);
                                    const itemClassName = isSelected
                                        ? 'w-full flex items-center justify-between px-3 py-1.5 text-xs bg-accent-background text-accent rounded transition-colors text-left cursor-pointer'
                                        : 'w-full flex items-center justify-between px-3 py-1.5 text-xs text-text hover:bg-surface-hover rounded transition-colors text-left cursor-pointer';

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleToggleOption(option.value)}
                                            className={itemClassName}
                                        >
                                            <span className="flex items-center gap-2 truncate">
                                                {option.icon && renderIcon(option.icon)}
                                                <span>{option.label}</span>
                                            </span>
                                            {isSelected && (
                                                <Check className={`${ICON_STYLE} text-accent`} />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </DropdownContainer>
                </div>
            )}

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && (
                <span className={FIELD_HELPER_STYLE}>{helperText}</span>
            )}
        </div>
    );
};

export {
    TextField,
    PasswordField,
    AreaField,
    SearchField,
    SelectField,
    ComboField,
};

export default {
    TextField,
    PasswordField,
    AreaField,
    SearchField,
    SelectField,
    ComboField,
};

// --- HELPERS ---
function renderIcon(icon) {
    if (!icon) {
        return null;
    }

    if (isValidElement(icon)) {
        const iconClassName = `${ICON_STYLE} ${icon.props.className ?? ''}`.trim();
        return cloneElement(icon, { className: iconClassName });
    }

    const IconComponent = icon;
    return <IconComponent className={ICON_STYLE} />;
}
