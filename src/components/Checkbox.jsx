// --- IMPORTS ---
import { forwardRef } from 'react';
import { Check, Minus } from 'lucide-react';


// --- COMPONENTS ---
const Checkbox = forwardRef(({
    checked = false,
    indeterminate = false,
    disabled = false,
    onChange,
    className = '',
    title,
    'aria-label': ariaLabel,
    ...props
}, ref) => {
    const isChecked = Boolean(checked);
    const isIndeterminate = Boolean(indeterminate);
    const isActive = isChecked || isIndeterminate;

    return (
        <label
            className={`relative inline-flex items-center justify-center shrink-0 cursor-pointer select-none ${
                disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
            } ${className}`.trim()}
            onClick={(e) => e.stopPropagation()}
            title={title}
        >
            <input
                ref={ref}
                type="checkbox"
                checked={isChecked}
                disabled={disabled}
                onChange={(e) => {
                    e.stopPropagation();
                    onChange?.(e);
                }}
                className="sr-only"
                aria-label={ariaLabel}
                {...props}
            />
            <div
                className={`h-4.5 w-4.5 rounded-md flex items-center justify-center transition-all duration-150 ease-out border shadow-2xs ${
                    isActive
                        ? 'bg-accent border-accent text-text-inverted'
                        : 'bg-surface border-surface-border hover:border-accent/60 hover:bg-surface-hover/80 text-transparent'
                }`}
            >
                {isIndeterminate ? (
                    <Minus className="h-3 w-3 stroke-[3]" />
                ) : isChecked ? (
                    <Check className="h-3 w-3 stroke-[3]" />
                ) : null}
            </div>
        </label>
    );
});

Checkbox.displayName = 'Checkbox';


// --- EXPORTS ---
export { Checkbox };
