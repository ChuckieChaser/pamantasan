// --- IMPORTS ---
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';


// --- CONFIGURATIONS ---
const TRIGGER_BASE_STYLE = 'h-9 px-3 text-sm rounded-md border bg-surface hover:bg-surface-hover/60 text-text transition-colors inline-flex items-center justify-between gap-2 w-full cursor-pointer select-none box-border touch-manipulation';
const SEARCH_INPUT_CONTAINER = 'h-9 px-3 border-b border-surface-border bg-surface inline-flex items-center gap-2 w-full shrink-0';

const BORDER_STATE_STYLE = {
    default: 'border-surface-border focus:border-accent',
    error:   'border-error focus:border-error',
};


// --- COMPONENTS ---
export const ComboBox = ({
    id,
    name,
    value,
    onChange,
    options = [],
    placeholder = 'Select option...',
    searchPlaceholder = 'Search...',
    leadingIcon: LeadingIcon,
    isDisabled = false,
    hasError = false,
    className = '',
    ...props
}) => {
    // --- HOOKS & STATE ---
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);

    // --- DERIVED VALUES ---
    const selectedOption = useMemo(() => {
        return options.find((opt) => opt.value === value) ?? null;
    }, [options, value]);

    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return options;
        const normalized = searchQuery.toLowerCase().trim();
        return options.filter((opt) => {
            const label = (opt.label ?? opt.name ?? String(opt.value)).toLowerCase();
            const description = opt.description ? opt.description.toLowerCase() : '';
            return label.includes(normalized) || description.includes(normalized);
        });
    }, [options, searchQuery]);

    const borderStyle = hasError ? BORDER_STATE_STYLE.error : BORDER_STATE_STYLE.default;
    const disabledStyle = isDisabled ? 'opacity-50 cursor-not-allowed bg-surface-hover' : '';
    const composedTriggerClassName = `${TRIGGER_BASE_STYLE} ${borderStyle} ${disabledStyle} ${className}`.trim();

    // --- HANDLERS ---
    const handleToggle = () => {
        if (isDisabled) return;
        setIsOpen((prev) => !prev);
    };

    const handleSelectOption = (option) => {
        onChange?.(option.value, option);
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleBackdropClick = (event) => {
        if (event.target === event.currentTarget) {
            setIsOpen(false);
            setSearchQuery('');
        }
    };

    // Auto-focus search input on open & click outside listener for desktop
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);

            const handleOutsideClick = (e) => {
                if (containerRef.current && !containerRef.current.contains(e.target)) {
                    setIsOpen(false);
                }
            };

            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    setIsOpen(false);
                }
            };

            document.addEventListener('mousedown', handleOutsideClick);
            document.addEventListener('keydown', handleKeyDown);

            return () => {
                document.removeEventListener('mousedown', handleOutsideClick);
                document.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isOpen]);

    // --- RENDER ---
    return (
        <div
            ref={containerRef}
            className="relative w-full"
            {...props}
        >
            {/* Trigger Button (36px) */}
            <button
                id={id}
                name={name}
                type="button"
                disabled={isDisabled}
                onClick={handleToggle}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className={composedTriggerClassName}
            >
                <span className="inline-flex items-center gap-2 truncate">
                    {LeadingIcon && (
                        <span className="shrink-0 text-text-muted">
                            {typeof LeadingIcon === 'function' ? <LeadingIcon className="h-4 w-4" /> : LeadingIcon}
                        </span>
                    )}

                    <span className={selectedOption ? 'text-text truncate' : 'text-text-muted truncate'}>
                        {selectedOption ? (selectedOption.label ?? selectedOption.name ?? selectedOption.value) : placeholder}
                    </span>
                </span>

                <ChevronDown className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu (Desktop Popover + Mobile Bottom Sheet) */}
            {isOpen && (
                <>
                    {/* Mobile Backdrop Overlay */}
                    <div
                        onClick={handleBackdropClick}
                        className="sm:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end"
                    >
                        <div className="w-full bg-surface rounded-t-2xl border-t border-surface-border max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
                            {/* Mobile Sheet Handle & Header */}
                            <div className="pt-3 pb-2 px-4 flex items-center justify-between border-b border-surface-border shrink-0">
                                <span className="text-sm font-semibold text-text">{placeholder}</span>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Search Filter */}
                            <div className={SEARCH_INPUT_CONTAINER}>
                                <Search className="h-4 w-4 text-text-muted shrink-0" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
                                />
                            </div>

                            {/* Options List */}
                            <div
                                role="listbox"
                                className="overflow-y-auto p-2 flex flex-col gap-1 max-h-[50vh]"
                            >
                                {filteredOptions.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-text-muted">
                                        No matching results
                                    </div>
                                ) : (
                                    filteredOptions.map((opt) => {
                                        const isSelected = opt.value === value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                disabled={opt.isDisabled}
                                                onClick={() => handleSelectOption(opt)}
                                                className={`min-h-10 px-3 py-2 text-sm rounded-md flex items-center justify-between gap-2 text-left transition-colors cursor-pointer touch-manipulation ${
                                                    isSelected ? 'bg-accent/10 text-accent font-medium' : 'text-text hover:bg-surface-hover'
                                                }`}
                                            >
                                                <div className="flex flex-col min-w-0">
                                                    <span className="truncate">{opt.label ?? opt.name ?? opt.value}</span>
                                                    {opt.description && (
                                                        <span className="text-xs text-text-muted truncate">{opt.description}</span>
                                                    )}
                                                </div>
                                                {isSelected && <Check className="h-4 w-4 shrink-0 text-accent" />}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Desktop Anchored Popover */}
                    <div className="hidden sm:block absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface border border-surface-border rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        {/* Search Input */}
                        <div className={SEARCH_INPUT_CONTAINER}>
                            <Search className="h-4 w-4 text-text-muted shrink-0" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
                            />
                        </div>

                        {/* Options List */}
                        <div
                            role="listbox"
                            className="max-h-56 overflow-y-auto p-1 flex flex-col gap-0.5"
                        >
                            {filteredOptions.length === 0 ? (
                                <div className="py-4 text-center text-xs text-text-muted">
                                    No options found
                                </div>
                            ) : (
                                filteredOptions.map((opt) => {
                                    const isSelected = opt.value === value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            disabled={opt.isDisabled}
                                            onClick={() => handleSelectOption(opt)}
                                            className={`h-8 px-2.5 text-xs rounded-sm flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                                                isSelected ? 'bg-accent/10 text-accent font-semibold' : 'text-text hover:bg-surface-hover'
                                            }`}
                                        >
                                            <span className="truncate">{opt.label ?? opt.name ?? opt.value}</span>
                                            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
