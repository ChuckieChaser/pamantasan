// --- IMPORTS ---
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Eye, EyeOff, Search, X } from 'lucide-react';
import { useClickOutside, useSmartPosition } from '../hooks';
import { Container } from './Container';
import { renderIcon } from './common';


// --- CONFIGURATIONS ---
const SIZE_STYLE = {
    sm: 'h-8 py-1 px-2.5 text-xs',
    md: 'h-9 py-1 px-3 text-xs sm:text-sm',
    lg: 'h-10.5 py-1.5 px-3.5 text-sm sm:text-base',
};

const BASE_STYLE = 'rounded-md border bg-surface hover:bg-surface-hover focus-within:bg-surface text-text placeholder:text-text-muted transition-colors inline-flex items-center gap-2 sm:gap-2.5 w-full disabled:cursor-not-allowed disabled:opacity-50';
const ICON_STYLE = 'h-4 w-4 shrink-0';

const FIELD_WRAPPER_STYLE = 'flex flex-col gap-1 w-full';
const FIELD_LABEL_STYLE = 'text-xs font-semibold text-text';
const FIELD_HELPER_STYLE = 'text-[11px] text-text-muted';
const FIELD_ERROR_STYLE = 'text-[11px] text-error font-medium';

const STATE_STYLE = {
    default: 'border-surface-border focus-within:border-accent',
    error:   'border-error-border focus-within:border-error',
};

const AREA_BASE_STYLE = 'p-3 text-sm rounded-md border bg-surface hover:bg-surface-hover focus-within:bg-surface text-text placeholder:text-text-muted transition-colors w-full min-h-20 flex items-start gap-2.5 disabled:cursor-not-allowed disabled:opacity-50';

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
    size = 'md',
    suffixButton = null,
    suffixText = null,
    onSuffixClick = null,
    suffixOptions = null,
    selectedSuffix = null,
    onSuffixChange = null,
    required = false,
    isRequired = false,
    isDisabled = false,
    isReadOnly = false,
    onChange,
    className,
    ...props
}) => {
    // STATES: SUFFIX DROPDOWN
    const [isSuffixOpen, setIsSuffixOpen] = useState(false);
    const suffixDropdownReference = useRef(null);

    useClickOutside(suffixDropdownReference, () => {
        setIsSuffixOpen(false);
    });

    // HANDLERS
    const handleChange = (event) => {
        if (isDisabled || isReadOnly) {
            return;
        }

        onChange?.(event);
    };

    // DERIVED VALUES
    const isFieldRequired = required || isRequired;
    const currentSizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedControlClassName = `${BASE_STYLE} ${currentSizeStyle} ${stateStyle} ${className ?? ''}`.trim();

    const renderedLeadingIcon = renderIcon(leadingIcon, ICON_STYLE);
    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    // UNIFIED SUFFIX CONTROL LOGIC
    const activeSuffixLabel = suffixButton || suffixText;
    const effectiveSuffixOptions = Array.isArray(suffixOptions) && suffixOptions.length > 0
        ? suffixOptions
        : (activeSuffixLabel ? [activeSuffixLabel] : null);

    const hasSuffixControl = Boolean(effectiveSuffixOptions && effectiveSuffixOptions.length > 0);
    const isInteractiveDropdown = Boolean(effectiveSuffixOptions && effectiveSuffixOptions.length > 1);
    const currentSelectedSuffix = selectedSuffix ?? (hasSuffixControl
        ? (typeof effectiveSuffixOptions[0] === 'object' ? effectiveSuffixOptions[0].value : effectiveSuffixOptions[0])
        : activeSuffixLabel ?? '');

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
                    <span className="text-text-muted shrink-0 flex items-center">
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
                    className="w-full bg-transparent text-inherit text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed min-w-0"
                    {...props}
                />

                {/* UNIFIED SUFFIX CONTROL (MATCHING PILL DESIGN) */}
                {hasSuffixControl && (
                    <div ref={suffixDropdownReference} className="relative shrink-0 flex items-center">
                        {isInteractiveDropdown ? (
                            <button
                                type="button"
                                disabled={isDisabled || isReadOnly}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (onSuffixClick) {
                                        onSuffixClick();
                                    }
                                    setIsSuffixOpen((prev) => !prev);
                                }}
                                className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-mono font-medium border border-surface-border transition-all cursor-pointer select-none disabled:opacity-50 ${
                                    isSuffixOpen
                                        ? 'bg-accent/10 border-accent/40 text-accent font-semibold shadow-xs'
                                        : 'bg-surface-hover hover:bg-surface-border text-text hover:text-accent'
                                }`}
                                title="Select extension"
                            >
                                <span className="truncate max-w-28 sm:max-w-36">{currentSelectedSuffix}</span>
                                <ChevronDown className={`h-3 w-3 text-text-muted transition-transform shrink-0 ${isSuffixOpen ? 'rotate-180 text-accent' : ''}`} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={isDisabled || isReadOnly}
                                onClick={(e) => {
                                    if (onSuffixClick) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onSuffixClick();
                                    }
                                }}
                                className={`h-7 px-2.5 rounded-md flex items-center text-xs font-mono font-medium border border-surface-border bg-surface-hover text-text-muted select-none ${
                                    onSuffixClick ? 'hover:bg-surface-border hover:text-text cursor-pointer' : 'cursor-default'
                                }`}
                                title={currentSelectedSuffix}
                            >
                                <span className="truncate max-w-28 sm:max-w-40">{currentSelectedSuffix}</span>
                            </button>
                        )}

                        {isInteractiveDropdown && isSuffixOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 min-w-36 max-h-48 overflow-y-auto bg-surface border border-surface-border rounded-lg shadow-xl py-1 flex flex-col gap-0.5 animate-fade-in">
                                {effectiveSuffixOptions.map((opt) => {
                                    const optVal = typeof opt === 'object' ? opt.value : opt;
                                    const optLabel = typeof opt === 'object' ? (opt.label ?? opt.value) : opt;
                                    const isSelected = optVal === currentSelectedSuffix;

                                    return (
                                        <button
                                            key={optVal}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onSuffixChange?.(optVal);
                                                setIsSuffixOpen(false);
                                            }}
                                            className={`px-3 py-1.5 text-xs font-mono text-left flex items-center justify-between gap-2 hover:bg-surface-hover transition-colors cursor-pointer ${
                                                isSelected ? 'bg-accent/10 text-accent font-bold' : 'text-text'
                                            }`}
                                        >
                                            <span className="truncate">{optLabel}</span>
                                            {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {renderedTrailingIcon && (
                    <span className="text-text-muted shrink-0 flex items-center">
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
    size = 'md',
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
    const currentSizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedControlClassName = `${BASE_STYLE} ${currentSizeStyle} ${stateStyle} ${className ?? ''}`.trim();

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
                    <span className="text-text-muted shrink-0 flex items-center">
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
                    className="w-full bg-transparent text-inherit text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed min-w-0"
                    {...props}
                />
                {renderedTrailingIcon ? (
                    <span className="text-text-muted shrink-0 flex items-center">
                        {renderedTrailingIcon}
                    </span>
                ) : (
                    <button
                        type="button"
                        tabIndex={-1}
                        disabled={isDisabled}
                        onClick={handleToggleVisibility}
                        className="text-text-muted hover:text-text transition-colors cursor-pointer shrink-0 flex items-center p-0.5"
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
    size = 'md',
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
    const currentSizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedControlClassName = `${BASE_STYLE} ${currentSizeStyle} ${stateStyle} ${className ?? ''}`.trim();

    const renderedLeadingIcon = leadingIcon
        ? renderIcon(leadingIcon, ICON_STYLE)
        : <Search className={ICON_STYLE} />;

    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    // RENDER
    return (
        <div className={FIELD_WRAPPER_STYLE}>
            {label && <label className={FIELD_LABEL_STYLE}>{label}</label>}

            <div className={composedControlClassName}>
                <span className="text-text-muted shrink-0 flex items-center">
                    {renderedLeadingIcon}
                </span>
                <input
                    type="text"
                    value={value}
                    disabled={isDisabled}
                    placeholder={placeholder}
                    onChange={handleChange}
                    className="w-full bg-transparent text-inherit text-text placeholder:text-text-muted outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed min-w-0"
                    {...props}
                />
                {renderedTrailingIcon ? (
                    <span className="text-text-muted shrink-0 flex items-center">
                        {renderedTrailingIcon}
                    </span>
                ) : value ? (
                    <button
                        type="button"
                        disabled={isDisabled}
                        onClick={handleClear}
                        className="text-text-muted hover:text-text transition-colors cursor-pointer shrink-0 flex items-center p-0.5"
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
    size = 'md',
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
    const [dropdownCoords, setDropdownCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0, openUpward: false, isPositioned: false });

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
        const estimatedDropdownHeight = Math.min(options.length * 36 + 16, 260);

        const openUpward = dropdownAlign === 'top' || (dropdownAlign === 'auto' && spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow);

        const top = rect.bottom + 4;
        const bottom = Math.max(8, window.innerHeight - rect.top + 4);

        let left = rect.left;
        const dropdownWidth = Math.max(rect.width, 180);

        if (dropdownAlign === 'right' || (left + dropdownWidth > window.innerWidth - 16)) {
            left = Math.max(16, rect.right - dropdownWidth);
        }

        setDropdownCoords({
            top,
            bottom,
            left: Math.max(16, Math.min(left, window.innerWidth - dropdownWidth - 16)),
            width: dropdownWidth,
            openUpward,
            isPositioned: true,
        });
    };

    useLayoutEffect(() => {
        if (!isOpen) return;

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, dropdownAlign, options.length]);

    // CLOSE IMMEDIATELY IF DISABLED
    useEffect(() => {
        if (isDisabled && isOpen) {
            setIsOpen(false);
        }
    }, [isDisabled, isOpen]);

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
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
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
    const currentSizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedTriggerClassName = `${BASE_STYLE} ${currentSizeStyle} ${stateStyle} justify-between cursor-pointer ${className ?? ''}`.trim();

    const displayLeadingIcon = leadingIcon ?? selectedOption?.icon;
    const renderedLeadingIcon = renderIcon(displayLeadingIcon, ICON_STYLE);
    const renderedTrailingIcon = renderIcon(trailingIcon, ICON_STYLE);

    const dropdownStyle = {
        position: 'fixed',
        top: dropdownCoords.openUpward ? 'auto' : `${dropdownCoords.top}px`,
        bottom: dropdownCoords.openUpward ? `${dropdownCoords.bottom}px` : 'auto',
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
                        <span className="text-text-muted shrink-0 flex items-center">
                            {renderedLeadingIcon}
                        </span>
                    )}
                    <span className={`truncate text-sm ${selectedOption ? 'text-text' : 'text-text-muted'}`}>
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
    size = 'md',
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

    const currentSizeStyle = SIZE_STYLE[size] ?? SIZE_STYLE.md;
    const stateStyle = error ? STATE_STYLE.error : STATE_STYLE.default;
    const composedTriggerClassName = `${BASE_STYLE} ${currentSizeStyle} ${stateStyle} justify-between cursor-pointer ${className ?? ''}`.trim();
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
                    className={`absolute z-[100] ${composedPositionStyle} min-w-full w-max max-w-[calc(100vw-2rem)] sm:max-w-2xl`}
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


const SuffixField = (props) => <TextField {...props} />;


// --- EXPORTS ---
export {
    AreaField,
    ComboField,
    PasswordField,
    SearchField,
    SelectField,
    SuffixField,
    TextField,
};
