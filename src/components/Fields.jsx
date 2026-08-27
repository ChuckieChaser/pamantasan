// --- IMPORTS ---
import { useState, useRef, useMemo, cloneElement, isValidElement } from 'react';
import { Search, Eye, EyeOff, ChevronDown, Check, X } from 'lucide-react';
import { DropdownContainer } from './Container';
import { useClickOutside, useSmartPosition } from '../hooks';

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

const DROPDOWN_VERTICAL_STYLE = {
    bottom: 'top-full mt-1',
    top: 'bottom-full mb-1',
};

const DROPDOWN_HORIZONTAL_STYLE = {
    left: 'left-0',
    right: 'right-0',
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

    // DERIVED VALUES
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

    // DERIVED VALUES
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

    // DERIVED VALUES
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

    // DERIVED VALUES
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
    dropdownAlign = 'auto',
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

    const position = useSmartPosition(triggerReference, dropdownReference, isOpen, dropdownAlign);

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

    // DERIVED VALUES
    const selectedOption = options.find((option) => option.value === value);
    const stateStyle = error
        ? CONTROL_STATE_STYLE.error
        : CONTROL_STATE_STYLE.default;
    const composedTriggerClassName = `${CONTROL_BASE_STYLE} ${stateStyle} justify-between cursor-pointer ${className ?? ''}`.trim();
    const verticalStyle = DROPDOWN_VERTICAL_STYLE[position.vertical] ?? DROPDOWN_VERTICAL_STYLE.bottom;
    const horizontalStyle = DROPDOWN_HORIZONTAL_STYLE[position.horizontal] ?? (
        dropdownAlign === 'right' ? DROPDOWN_HORIZONTAL_STYLE.right : DROPDOWN_HORIZONTAL_STYLE.left
    );
    const composedPositionStyle = `${verticalStyle} ${horizontalStyle}`;

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
                <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                    {displayLeadingIcon && (
                        <span className="text-text-muted shrink-0">
                            {renderIcon(displayLeadingIcon)}
                        </span>
                    )}
                    <span className={`truncate ${selectedOption ? 'text-text' : 'text-text-muted'}`}>
                        {selectedOption?.label ?? placeholder}
                    </span>
                </div>
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
                    className={`absolute z-50 min-w-full w-max max-w-sm sm:max-w-md ${composedPositionStyle}`}
                >
                    <DropdownContainer className="p-1 max-h-60 overflow-y-auto shadow-xl flex flex-col gap-1 border border-surface-border bg-surface">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            const itemClassName = isSelected
                                ? 'w-full h-6 flex items-center justify-between px-2 text-xs bg-accent-background text-accent font-semibold rounded-md transition-colors text-left cursor-pointer select-none gap-2 whitespace-nowrap'
                                : 'w-full h-6 flex items-center justify-between px-2 text-xs text-text hover:bg-surface-hover rounded-md transition-colors text-left cursor-pointer select-none gap-2 whitespace-nowrap';

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelectOption(option.value)}
                                    className={itemClassName}
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {option.icon && (
                                            <span className="text-text-muted shrink-0">
                                                {renderIcon(option.icon)}
                                            </span>
                                        )}
                                        <span className="whitespace-nowrap">{option.label}</span>
                                    </div>
                                    {isSelected && <Check className={`${ICON_STYLE} text-accent shrink-0`} />}
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

// 6. COMBO FIELD (MULTI-CATEGORY FACETED DROPDOWN)
const ComboField = ({
    label,
    value,
    values,
    options = [],
    placeholder = 'Filter criteria...',
    leadingIcon,
    trailingIcon,
    dropdownAlign = 'auto',
    multiple = true,
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

    const position = useSmartPosition(triggerReference, dropdownReference, isOpen, dropdownAlign);

    // DERIVED VALUES
    const selectedValues = useMemo(() => {
        const rawValues = value ?? values ?? [];
        if (Array.isArray(rawValues)) {
            return rawValues;
        }
        return rawValues !== undefined && rawValues !== null && rawValues !== ''
            ? [rawValues]
            : [];
    }, [value, values]);

    const categorizedGroups = useMemo(() => {
        const groupsMap = new Map();

        options.forEach((option) => {
            const categoryName = option.category ?? 'Options';
            if (!groupsMap.has(categoryName)) {
                groupsMap.set(categoryName, []);
            }
            groupsMap.get(categoryName).push(option);
        });

        return Array.from(groupsMap.entries()).map(([categoryTitle, categoryOptions]) => ({
            title: categoryTitle,
            options: categoryOptions,
        }));
    }, [options]);

    const stateStyle = error
        ? CONTROL_STATE_STYLE.error
        : CONTROL_STATE_STYLE.default;
    const composedTriggerClassName = `${CONTROL_BASE_STYLE} ${stateStyle} justify-between cursor-pointer ${className ?? ''}`.trim();
    const verticalStyle = DROPDOWN_VERTICAL_STYLE[position.vertical] ?? DROPDOWN_VERTICAL_STYLE.bottom;
    const horizontalStyle = DROPDOWN_HORIZONTAL_STYLE[position.horizontal] ?? (
        dropdownAlign === 'right' ? DROPDOWN_HORIZONTAL_STYLE.right : DROPDOWN_HORIZONTAL_STYLE.left
    );
    const composedPositionStyle = `${verticalStyle} ${horizontalStyle}`;
    const displayLeadingIcon = leadingIcon;

    // HANDLERS
    const handleToggleOpen = () => {
        if (disabled) {
            return;
        }

        setIsOpen((previousState) => !previousState);
    };

    const handleToggleOption = (optionValue) => {
        if (disabled) {
            return;
        }

        if (!multiple) {
            onChange?.(optionValue);
            setIsOpen(false);
            return;
        }

        const isAlreadySelected = selectedValues.includes(optionValue);
        const updatedValues = isAlreadySelected
            ? selectedValues.filter((currentValue) => currentValue !== optionValue)
            : [...selectedValues, optionValue];

        onChange?.(updatedValues);
    };

    const handleClearAll = (event) => {
        event.stopPropagation();
        if (disabled) {
            return;
        }

        onChange?.(multiple ? [] : null);
    };

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
                <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                    {displayLeadingIcon && (
                        <span className="text-text-muted shrink-0">
                            {renderIcon(displayLeadingIcon)}
                        </span>
                    )}
                    {selectedValues.length === 0 ? (
                        <span className="text-text-muted truncate">{placeholder}</span>
                    ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-accent-background text-accent font-semibold shrink-0">
                            {selectedValues.length} active
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {selectedValues.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-text-muted hover:text-text transition-colors p-1 cursor-pointer"
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
                    className={`absolute z-50 ${composedPositionStyle} min-w-full w-max max-w-[calc(100vw-2rem)] sm:max-w-2xl`}
                >
                    <DropdownContainer className="p-1 overflow-hidden shadow-2xl border border-surface-border bg-surface flex flex-col">
                        {/* CATEGORY COLUMNS IN HORIZONTAL WIDTH ( | Category 1 | Category 2 | ... | ) */}
                        {categorizedGroups.length === 0 ? (
                            <div className="p-4 text-xs text-text-muted text-center">
                                No options available
                            </div>
                        ) : (
                            <div className="flex flex-row divide-x divide-surface-border overflow-x-auto max-h-72">
                                {categorizedGroups.map((group) => (
                                    <div
                                        key={group.title}
                                        className="flex flex-col shrink-0 min-w-28 w-max max-w-xs"
                                    >
                                        {/* CATEGORY COLUMN HEADER */}
                                        <div className="px-3 pt-2 pb-1 flex items-center justify-between shrink-0">
                                            <span className="font-bold text-xs text-text-muted uppercase tracking-wider select-none whitespace-nowrap">
                                                {group.title}
                                            </span>
                                        </div>

                                        {/* CATEGORY OPTIONS LIST */}
                                        <div className="p-1 flex flex-col gap-1 overflow-y-auto flex-1">
                                            {group.options.map((option) => {
                                                const isSelected = selectedValues.includes(option.value);

                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => handleToggleOption(option.value)}
                                                        className={`w-full h-6 flex items-center justify-between px-2 rounded-md text-xs transition-colors cursor-pointer text-left select-none gap-3 whitespace-nowrap ${
                                                            isSelected
                                                                ? 'bg-accent-background text-accent font-semibold'
                                                                : 'text-text hover:bg-surface-hover'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {multiple && (
                                                                <div
                                                                    className={`h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                                                        isSelected
                                                                            ? 'bg-accent border-accent text-text-inverted'
                                                                            : 'border-surface-border bg-surface'
                                                                    }`}
                                                                >
                                                                    {isSelected && (
                                                                        <Check className="h-3 w-3 stroke-[3]" />
                                                                    )}
                                                                </div>
                                                            )}
                                                            <span className="whitespace-nowrap" title={option.label}>
                                                                {option.label}
                                                            </span>
                                                        </div>

                                                        {!multiple && isSelected && (
                                                            <Check className={`${ICON_STYLE} text-accent shrink-0`} />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
