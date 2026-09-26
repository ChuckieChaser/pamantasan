// --- IMPORTS ---
import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';


// --- CONFIGURATIONS ---
const CONTAINER_BASE_STYLE = 'h-9 px-3 text-sm rounded-md border bg-surface hover:bg-surface-hover/60 focus-within:bg-surface text-text placeholder:text-text-muted transition-colors inline-flex items-center gap-2 w-full box-border';
const ICON_STYLE = 'h-4 w-4 shrink-0 text-text-muted';
const ACTION_BUTTON_STYLE = 'h-5 w-5 p-0.5 inline-flex items-center justify-center rounded-sm text-text-muted hover:text-text hover:bg-surface-hover cursor-pointer transition-colors';

const BORDER_STATE_STYLE = {
    default: 'border-surface-border focus-within:border-accent',
    error:   'border-error focus-within:border-error',
};


// --- COMPONENTS ---
export const Input = ({
    type = 'text',
    id,
    name,
    value,
    onChange,
    placeholder,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    isDisabled = false,
    isReadOnly = false,
    hasError = false,
    isClearable = false,
    onClear,
    className = '',
    inputClassName = '',
    ...props
}) => {
    // --- HOOKS & STATE ---
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // --- DERIVED VALUES ---
    const isPasswordType = type === 'password';
    const effectiveType = isPasswordType && isPasswordVisible ? 'text' : type;
    const borderStyle = hasError ? BORDER_STATE_STYLE.error : BORDER_STATE_STYLE.default;
    const disabledStyle = isDisabled ? 'opacity-50 cursor-not-allowed bg-surface-hover' : '';
    const composedContainerClassName = `${CONTAINER_BASE_STYLE} ${borderStyle} ${disabledStyle} ${className}`.trim();
    const showClearButton = isClearable && !isDisabled && !isReadOnly && Boolean(value);

    // --- HANDLERS ---
    const handleClear = (event) => {
        event.stopPropagation();
        onClear?.();
        if (onChange) {
            onChange({ target: { name, value: '' } });
        }
    };

    const handleTogglePasswordVisibility = (event) => {
        event.stopPropagation();
        setIsPasswordVisible((prev) => !prev);
    };

    // --- RENDER ---
    return (
        <div className={composedContainerClassName}>
            {LeadingIcon && (
                <span className="shrink-0 inline-flex items-center text-text-muted">
                    {typeof LeadingIcon === 'function' ? <LeadingIcon className={ICON_STYLE} /> : LeadingIcon}
                </span>
            )}

            <input
                id={id}
                name={name}
                type={effectiveType}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={isDisabled}
                readOnly={isReadOnly}
                className={`w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none focus:outline-none disabled:cursor-not-allowed ${inputClassName}`.trim()}
                {...props}
            />

            {showClearButton && (
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Clear input"
                    onClick={handleClear}
                    className={ACTION_BUTTON_STYLE}
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}

            {isPasswordType && (
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                    onClick={handleTogglePasswordVisibility}
                    className={ACTION_BUTTON_STYLE}
                >
                    {isPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
            )}

            {TrailingIcon && !isPasswordType && !showClearButton && (
                <span className="shrink-0 inline-flex items-center text-text-muted">
                    {typeof TrailingIcon === 'function' ? <TrailingIcon className={ICON_STYLE} /> : TrailingIcon}
                </span>
            )}
        </div>
    );
};
