// --- IMPORTS ---
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Eye, EyeOff, Search, X } from 'lucide-react';
import { useClickOutside, useSmartPosition } from '../hooks';
import { Container } from './Container';
import { renderIcon } from './common';


// --- CONFIGURATIONS ---
const BASE_STYLE = 'h-9 py-1 px-3 text-sm rounded-md border bg-surface hover:bg-surface-hover focus-within:bg-surface text-text placeholder:text-text-muted transition-colors inline-flex items-center gap-2 w-full disabled:cursor-not-allowed disabled:opacity-50';
const ICON_STYLE = 'h-4 w-4 shrink-0';

const FIELD_WRAPPER_STYLE = 'flex flex-col gap-1 w-full';
const FIELD_LABEL_STYLE = 'text-xs font-medium text-text';
const FIELD_HELPER_STYLE = 'text-xs text-text-muted';
const FIELD_ERROR_STYLE = 'text-xs text-error';

const STATE_STYLE = {
    default: 'border-surface-border focus-within:border-accent',
    error:   'border-error-border focus-within:border-error',
};

const AREA_BASE_STYLE = 'p-3 text-sm rounded-md border bg-surface hover:bg-surface-hover focus-within:bg-surface text-text placeholder:text-text-muted transition-colors w-full min-h-20 flex items-start gap-2 disabled:cursor-not-allowed disabled:opacity-50';

const DROPDOWN_VERTICAL_STYLE = {
    bottom: 'top-full mt-1',
    top:    'bottom-full mb-1',
};

const DROPDOWN_HORIZONTAL_STYLE = {
    left:  'left-0',
    right: 'right-0',
};


// --- COMPONENTS ---
const TextField = ({
    label,
    error,
    helperText,
    leadingIcon,
    trailingIcon,
    type = 'text',
    value,
    placeholder,
    required = false,
    isRequired = false,
    isDisabled = false,
    isReadOnly = false,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleChange = (event) => {
        if (isDisabled || isReadOnly) {
            return;
        }

        onChange?.(event);
    };

    // DERIVED VALUES
    const isFieldRequired = required || isRequired;
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedControlClassName = `${BASE_STYLE} ${stateStyle} ${className ?? ''}`.trim();

    const renderedLeadingIcon = renderIcon(leadingIcon, ICON_STYLE);
    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    // RENDER
    return (
        <div className={FIELD_WRAPPER_STYLE}>
            {label && (
                <label className={FIELD_LABEL_STYLE}>
                    {label}
                    {isFieldRequired && <span className="text-error ml-1 font-semibold">*</span>}
                </label>
            )}

            <div className={composedControlClassName}>
                {renderedLeadingIcon && (
                    <span className="text-text-muted shrink-0">
                        {renderedLeadingIcon}
                    </span>
                )}
                <input
                    type={type}
                    value={value}
                    disabled={isDisabled}
                    readOnly={isReadOnly}
                    required={isFieldRequired}
                    placeholder={placeholder}
                    onChange={handleChange}
                    className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
                    {...props}
                />
                {renderedTrailingIcon && (
                    <span className="text-text-muted shrink-0">
                        {renderedTrailingIcon}
                    </span>
                )}
            </div>

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && <span className={FIELD_HELPER_STYLE}>{helperText}</span>}
        </div>
    );
};

const PasswordField = ({
    label,
    error,
    helperText,
    leadingIcon,
    trailingIcon,
    value,
    placeholder = 'Enter password...',
    required = false,
    isRequired = false,
    isDisabled = false,
    isReadOnly = false,
    onChange,
    className,
    ...props
}) => {
    // STATES
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // HANDLERS
    const handleToggleVisibility = () => {
        if (isDisabled) {
            return;
        }

        setIsPasswordVisible((previousState) => !previousState);
    };

    const handleChange = (event) => {
        if (isDisabled || isReadOnly) {
            return;
        }

        onChange?.(event);
    };

    // DERIVED VALUES
    const isFieldRequired = required || isRequired;
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedControlClassName = `${BASE_STYLE} ${stateStyle} ${className ?? ''}`.trim();

    const renderedLeadingIcon = renderIcon(leadingIcon, ICON_STYLE);
    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    // RENDER
    return (
        <div className={FIELD_WRAPPER_STYLE}>
            {label && (
                <label className={FIELD_LABEL_STYLE}>
                    {label}
                    {isFieldRequired && <span className="text-error ml-1 font-semibold">*</span>}
                </label>
            )}

            <div className={composedControlClassName}>
                {renderedLeadingIcon && (
                    <span className="text-text-muted shrink-0">
                        {renderedLeadingIcon}
                    </span>
                )}
                <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={value}
                    disabled={isDisabled}
                    readOnly={isReadOnly}
                    required={isFieldRequired}
                    placeholder={placeholder}
                    onChange={handleChange}
                    className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
                    {...props}
                />
                {renderedTrailingIcon ? (
                    <span className="text-text-muted shrink-0">
                        {renderedTrailingIcon}
                    </span>
                ) : (
                    <button
                        type="button"
                        tabIndex={-1}
                        disabled={isDisabled}
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
            {!error && helperText && <span className={FIELD_HELPER_STYLE}>{helperText}</span>}
        </div>
    );
};

const AreaField = ({
    label,
    error,
    helperText,
    leadingIcon,
    value,
    placeholder,
    rows = 3,
    required = false,
    isRequired = false,
    isDisabled = false,
    isReadOnly = false,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleChange = (event) => {
        if (isDisabled || isReadOnly) {
            return;
        }

        onChange?.(event);
    };

    // DERIVED VALUES
    const isFieldRequired = required || isRequired;
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedAreaClassName = `${AREA_BASE_STYLE} ${stateStyle} ${className ?? ''}`.trim();

    const renderedLeadingIcon = renderIcon(leadingIcon, ICON_STYLE);

    // RENDER
    return (
        <div className={FIELD_WRAPPER_STYLE}>
            {label && (
                <label className={FIELD_LABEL_STYLE}>
                    {label}
                    {isFieldRequired && <span className="text-error ml-1 font-semibold">*</span>}
                </label>
            )}

            <div className={composedAreaClassName}>
                {renderedLeadingIcon && (
                    <span className="text-text-muted shrink-0 pt-1">
                        {renderedLeadingIcon}
                    </span>
                )}

                <textarea
                    rows={rows}
                    value={value}
                    disabled={isDisabled}
                    readOnly={isReadOnly}
                    required={isFieldRequired}
                    placeholder={placeholder}
                    onChange={handleChange}
                    className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none resize-y border-none p-0 disabled:cursor-not-allowed"
                    {...props}
                />
            </div>

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && <span className={FIELD_HELPER_STYLE}>{helperText}</span>}
        </div>
    );
};

const SearchField = ({
    label,
    error,
    helperText,
    leadingIcon,
    trailingIcon,
    value,
    placeholder = 'Search...',
    isDisabled = false,
    onClear,
    onChange,
    className,
    ...props
}) => {
    // HANDLERS
    const handleChange = (event) => {
        if (isDisabled) {
            return;
        }

        onChange?.(event);
    };

    const handleClear = () => {
        if (isDisabled) {
            return;
        }

        onClear?.();
    };

    // DERIVED VALUES
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedControlClassName = `${BASE_STYLE} ${stateStyle} ${className ?? ''}`.trim();

    const renderedLeadingIcon = leadingIcon
        ? renderIcon(leadingIcon, ICON_STYLE)
        : <Search className={ICON_STYLE} />;

    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    // RENDER
    return (
        <div className={FIELD_WRAPPER_STYLE}>
            {label && <label className={FIELD_LABEL_STYLE}>{label}</label>}

            <div className={composedControlClassName}>
                <span className="text-text-muted shrink-0">
                    {renderedLeadingIcon}
                </span>
                <input
                    type="text"
                    value={value}
                    disabled={isDisabled}
                    placeholder={placeholder}
                    onChange={handleChange}
                    className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
                    {...props}
                />
                {renderedTrailingIcon ? (
                    <span className="text-text-muted shrink-0">
                        {renderedTrailingIcon}
                    </span>
                ) : value ? (
                    <button
                        type="button"
                        disabled={isDisabled}
                        onClick={handleClear}
                        className="text-text-muted hover:text-text transition-colors cursor-pointer shrink-0"
                        title="Clear search"
                    >
                        <X className={ICON_STYLE} />
                    </button>
                ) : null}
            </div>

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && <span className={FIELD_HELPER_STYLE}>{helperText}</span>}
        </div>
    );
};

const SelectField = ({
    label,
    value,
    options = [],
    placeholder = 'Select option...',
    leadingIcon,
    trailingIcon,
    dropdownAlign = 'auto',
    required = false,
    isRequired = false,
    isDisabled = false,
    error,
    helperText,
    onChange,
    className,
    ...props
}) => {
    // STATES
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0, openUpward: false, isPositioned: false });

    // REFS
    const containerRef = useRef(null);
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);

    // POSITION CALCULATION
    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const estimatedDropdownHeight = Math.min(options.length * 32 + 16, 240);

        const openUpward = dropdownAlign === 'top' || (dropdownAlign === 'auto' && spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow);

        const top = openUpward
            ? rect.top - 4
            : rect.bottom + 4;

        let left = rect.left;
        const dropdownWidth = Math.max(rect.width, 180);

        if (dropdownAlign === 'right' || (left + dropdownWidth > window.innerWidth - 16)) {
            left = Math.max(16, rect.right - dropdownWidth);
        }

        setDropdownCoords({
            top: openUpward ? undefined : top,
            bottom: openUpward ? (window.innerHeight - rect.top + 4) : undefined,
            left: Math.max(16, Math.min(left, window.innerWidth - dropdownWidth - 16)),
            width: dropdownWidth,
            openUpward,
            isPositioned: true,
        });
    };

    useLayoutEffect(() => {
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, dropdownAlign]);

    // OUTSIDE CLICK (CHECK CONTAINER AND PORTAL DROPDOWN)
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (
                containerRef.current?.contains(event.target) ||
                dropdownRef.current?.contains(event.target)
            ) {
                return;
            }
            setIsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    // HANDLERS
    const handleToggleOpen = () => {
        if (isDisabled) {
            return;
        }

        if (!isOpen) {
            updatePosition();
        }

        setIsOpen((previousState) => !previousState);
    };

    const handleSelectOption = (optionValue) => {
        if (isDisabled) {
            return;
        }

        onChange?.(optionValue);
        setIsOpen(false);
    };

    // DERIVED VALUES
    const isFieldRequired = required || isRequired;
    const selectedOption = options.find((option) => option.value === value);
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedTriggerClassName = `${BASE_STYLE} ${stateStyle} justify-between cursor-pointer ${className ?? ''}`.trim();

    const displayLeadingIcon = leadingIcon ?? selectedOption?.icon;
    const renderedLeadingIcon = renderIcon(displayLeadingIcon, ICON_STYLE);
    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    const dropdownStyle = {
        position: 'fixed',
        top: dropdownCoords.openUpward ? 'auto' : `${dropdownCoords.top + 4}px`,
        bottom: dropdownCoords.openUpward ? `${Math.max(8, window.innerHeight - dropdownCoords.top + 4)}px` : 'auto',
        left: dropdownAlign === 'right' ? 'auto' : `${Math.max(8, dropdownCoords.left)}px`,
        right: dropdownAlign === 'right' ? `${Math.max(8, window.innerWidth - (dropdownCoords.left + dropdownCoords.width))}px` : 'auto',
        minWidth: `${dropdownCoords.width}px`,
        zIndex: 99999,
        visibility: dropdownCoords.isPositioned ? 'visible' : 'hidden',
    };

    // RENDER
    return (
        <div
            ref={containerRef}
            className={`${FIELD_WRAPPER_STYLE} relative`}
            {...props}
        >
            {label && (
                <label className={FIELD_LABEL_STYLE}>
                    {label}
                    {isFieldRequired && <span className="text-error ml-1 font-semibold">*</span>}
                </label>
            )}

            <button
                ref={triggerRef}
                type="button"
                disabled={isDisabled}
                onClick={handleToggleOpen}
                className={composedTriggerClassName}
            >
                <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                    {renderedLeadingIcon && (
                        <span className="text-text-muted shrink-0">
                            {renderedLeadingIcon}
                        </span>
                    )}
                    <span className={`truncate ${selectedOption ? 'text-text' : 'text-text-muted'}`}>
                        {selectedOption?.label ?? placeholder}
                    </span>
                </div>
                <span className="text-text-muted shrink-0">
                    {renderedTrailingIcon ? (
                        renderedTrailingIcon
                    ) : (
                        <ChevronDown
                            className={`${ICON_STYLE} transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    )}
                </span>
            </button>

            {isOpen && dropdownCoords.isPositioned && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    style={dropdownStyle}
                    onClick={(event) => event.stopPropagation()}
                    className="w-max max-w-sm sm:max-w-md shadow-2xl"
                >
                    <Container
                        variant="dropdown"
                        className="max-h-60 overflow-y-auto"
                    >
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            const itemClassName = isSelected
                                ? 'w-full h-7 flex items-center justify-between px-2 text-xs bg-accent-background text-accent font-semibold rounded-md transition-colors text-left cursor-pointer select-none gap-2 whitespace-nowrap'
                                : 'w-full h-7 flex items-center justify-between px-2 text-xs text-text hover:bg-surface-hover rounded-md transition-colors text-left cursor-pointer select-none gap-2 whitespace-nowrap';

                            const renderedOptionIcon = renderIcon(option.icon, ICON_STYLE);

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleSelectOption(option.value);
                                    }}
                                    className={itemClassName}
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {renderedOptionIcon && (
                                            <span className="text-text-muted shrink-0">
                                                {renderedOptionIcon}
                                            </span>
                                        )}
                                        <span className="whitespace-nowrap">{option.label}</span>
                                    </div>
                                    {isSelected && <Check className={`${ICON_STYLE} text-accent shrink-0`} />}
                                </button>
                            );
                        })}
                    </Container>
                </div>,
                document.body
            )}

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && <span className={FIELD_HELPER_STYLE}>{helperText}</span>}
        </div>
    );
};

const ComboField = ({
    label,
    value,
    values,
    options = [],
    placeholder = 'Filter criteria...',
    leadingIcon,
    trailingIcon,
    dropdownAlign = 'auto',
    isMultiple = true,
    required = false,
    isRequired = false,
    isDisabled = false,
    error,
    helperText,
    onChange,
    className,
    ...props
}) => {
    // STATES
    const [isOpen, setIsOpen] = useState(false);

    // REFS
    const containerRef = useRef(null);
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);

    // HOOKS
    useClickOutside(containerRef, () => {
        setIsOpen(false);
    });

    const position = useSmartPosition(triggerRef, dropdownRef, isOpen, dropdownAlign);

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

    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedTriggerClassName = `${BASE_STYLE} ${stateStyle} justify-between cursor-pointer ${className ?? ''}`.trim();
    const verticalStyle = DROPDOWN_VERTICAL_STYLE[position.vertical] ?? DROPDOWN_VERTICAL_STYLE.bottom;
    const horizontalStyle = DROPDOWN_HORIZONTAL_STYLE[position.horizontal] ?? (
        dropdownAlign === 'right' ? DROPDOWN_HORIZONTAL_STYLE.right : DROPDOWN_HORIZONTAL_STYLE.left
    );
    const composedPositionStyle = `${verticalStyle} ${horizontalStyle}`;
    const renderedLeadingIcon = renderIcon(leadingIcon, ICON_STYLE);
    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    // HANDLERS
    const handleToggleOpen = () => {
        if (isDisabled) {
            return;
        }

        setIsOpen((previousState) => !previousState);
    };

    const handleToggleOption = (optionValue) => {
        if (isDisabled) {
            return;
        }

        if (!isMultiple) {
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
        if (isDisabled) {
            return;
        }

        onChange?.(isMultiple ? [] : null);
    };

    // RENDER
    const isFieldRequired = required || isRequired;
    return (
        <div
            ref={containerRef}
            className={`${FIELD_WRAPPER_STYLE} relative`}
            {...props}
        >
            {label && (
                <label className={FIELD_LABEL_STYLE}>
                    {label}
                    {isFieldRequired && <span className="text-error ml-1 font-semibold">*</span>}
                </label>
            )}

            <button
                ref={triggerRef}
                type="button"
                disabled={isDisabled}
                onClick={handleToggleOpen}
                className={composedTriggerClassName}
            >
                <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                    {renderedLeadingIcon && (
                        <span className="text-text-muted shrink-0">
                            {renderedLeadingIcon}
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
                        {renderedTrailingIcon ? (
                            renderedTrailingIcon
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
                    ref={dropdownRef}
                    className={`absolute z-50 ${composedPositionStyle} min-w-full w-max max-w-[calc(100vw-2rem)] sm:max-w-2xl`}
                >
                    <Container
                        variant="dropdown"
                        className="overflow-hidden shadow-2xl p-1 flex flex-col"
                    >
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
                                        <div className="px-3 pt-2 pb-1 flex items-center justify-between shrink-0">
                                            <span className="font-bold text-xs text-text-muted uppercase tracking-wider select-none whitespace-nowrap">
                                                {group.title}
                                            </span>
                                        </div>

                                        <div className="p-1 flex flex-col gap-1 overflow-y-auto flex-1">
                                            {group.options.map((option) => {
                                                const isSelected = selectedValues.includes(option.value);

                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => handleToggleOption(option.value)}
                                                        className={`w-full h-7 flex items-center justify-between px-2 rounded-md text-xs transition-colors cursor-pointer text-left select-none gap-3 whitespace-nowrap ${
                                                            isSelected
                                                                ? 'bg-accent-background text-accent font-semibold'
                                                                : 'text-text hover:bg-surface-hover'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {isMultiple && (
                                                                <div
                                                                    className={`h-4 w-4 rounded-sm border flex items-center justify-center transition-colors shrink-0 ${
                                                                        isSelected
                                                                            ? 'bg-accent border-accent text-text-inverted'
                                                                            : 'border-surface-border bg-surface'
                                                                    }`}
                                                                >
                                                                    {isSelected && (
                                                                        <Check className="h-3 w-3" />
                                                                    )}
                                                                </div>
                                                            )}
                                                            <span className="whitespace-nowrap" title={option.label}>
                                                                {option.label}
                                                            </span>
                                                        </div>

                                                        {!isMultiple && isSelected && (
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
                    </Container>
                </div>
            )}

            {error && <span className={FIELD_ERROR_STYLE}>{error}</span>}
            {!error && helperText && <span className={FIELD_HELPER_STYLE}>{helperText}</span>}
        </div>
    );
};


// --- EXPORTS ---
export {
    AreaField,
    ComboField,
    PasswordField,
    SearchField,
    SelectField,
    TextField,
};
