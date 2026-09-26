// --- IMPORTS ---
import { ChevronDown } from 'lucide-react';


// --- CONFIGURATIONS ---
const CONTAINER_BASE_STYLE = 'relative h-9 px-3 text-sm rounded-md border bg-surface hover:bg-surface-hover/60 focus-within:bg-surface text-text transition-colors inline-flex items-center gap-2 w-full box-border';
const ICON_STYLE = 'h-4 w-4 shrink-0 text-text-muted';

const BORDER_STATE_STYLE = {
    default: 'border-surface-border focus-within:border-accent',
    error:   'border-error focus-within:border-error',
};


// --- COMPONENTS ---
export const Select = ({
    id,
    name,
    value,
    onChange,
    options = [],
    placeholder = 'Select option...',
    leadingIcon: LeadingIcon,
    isDisabled = false,
    hasError = false,
    className = '',
    children,
    ...props
}) => {
    // --- DERIVED VALUES ---
    const borderStyle = hasError ? BORDER_STATE_STYLE.error : BORDER_STATE_STYLE.default;
    const disabledStyle = isDisabled ? 'opacity-50 cursor-not-allowed bg-surface-hover' : '';
    const composedContainerClassName = `${CONTAINER_BASE_STYLE} ${borderStyle} ${disabledStyle} ${className}`.trim();

    // --- RENDER ---
    return (
        <div className={composedContainerClassName}>
            {LeadingIcon && (
                <span className="shrink-0 inline-flex items-center text-text-muted">
                    {typeof LeadingIcon === 'function' ? <LeadingIcon className={ICON_STYLE} /> : LeadingIcon}
                </span>
            )}

            <select
                id={id}
                name={name}
                value={value ?? ''}
                onChange={onChange}
                disabled={isDisabled}
                className="w-full bg-transparent text-sm text-text outline-none focus:outline-none appearance-none cursor-pointer disabled:cursor-not-allowed pr-6"
                {...props}
            >
                {placeholder && (
                    <option
                        value=""
                        disabled
                        className="bg-surface text-text-muted"
                    >
                        {placeholder}
                    </option>
                )}

                {children ?? options.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                        disabled={option.isDisabled || option.disabled}
                        className="bg-surface text-text"
                    >
                        {option.label ?? option.name ?? option.value}
                    </option>
                ))}
            </select>

            <span className="absolute right-3 pointer-events-none text-text-muted inline-flex items-center">
                <ChevronDown className="h-4 w-4" />
            </span>
        </div>
    );
};
