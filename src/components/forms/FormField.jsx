// --- IMPORTS ---


// --- CONFIGURATIONS ---
const WRAPPER_STYLE = 'flex flex-col gap-1.5 w-full';
const LABEL_STYLE = 'text-xs font-medium text-text select-none inline-flex items-center gap-1';
const HELPER_STYLE = 'text-xs text-text-muted';
const ERROR_STYLE = 'text-xs text-error font-medium';


// --- COMPONENTS ---
export const FormField = ({
    id,
    label,
    isRequired = false,
    helperText,
    errorMessage,
    className = '',
    children,
    ...props
}) => {
    // --- DERIVED VALUES ---
    const composedWrapperClassName = `${WRAPPER_STYLE} ${className}`.trim();
    const hasError = Boolean(errorMessage);

    // --- RENDER ---
    return (
        <div
            className={composedWrapperClassName}
            {...props}
        >
            {label && (
                <label
                    htmlFor={id}
                    className={LABEL_STYLE}
                >
                    <span>{label}</span>
                    {isRequired && (
                        <span
                            className="text-error font-semibold"
                            aria-hidden="true"
                        >
                            *
                        </span>
                    )}
                </label>
            )}

            {children}

            {hasError ? (
                <p
                    id={id ? `${id}-error` : undefined}
                    role="alert"
                    className={ERROR_STYLE}
                >
                    {errorMessage}
                </p>
            ) : helperText ? (
                <p
                    id={id ? `${id}-helper` : undefined}
                    className={HELPER_STYLE}
                >
                    {helperText}
                </p>
            ) : null}
        </div>
    );
};
