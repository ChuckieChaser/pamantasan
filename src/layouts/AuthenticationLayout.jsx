// --- IMPORTS ---
import {
    ArrowLeft,
} from 'lucide-react';
import backgroundImage from '../assets/background.jpg';
import logoImage from '../assets/logo.jpg';
import { CardContainer } from '../components';

// --- CONFIGURATIONS ---
const BASE_LAYOUT_STYLE = 'relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none bg-surface text-text';
const CARD_BASE_STYLE = 'bg-surface border border-surface-border shadow-2xl rounded-2xl p-6 sm:p-8 flex flex-col gap-6 text-text w-full';

// --- COMPONENTS ---
const AuthenticationLayout = ({
    title,
    description,
    icon,
    backButtonLabel = 'Back',
    showBrandHeader = true,
    showFooter = true,
    headerActions,
    footer,
    onBack,
    className,
    cardClassName,
    children,
    ...props
}) => {
    // HANDLERS
    const handleBackClick = (event) => {
        onBack?.(event);
    };

    // DERIVED VALUES
    const composedLayoutStyle = `${BASE_LAYOUT_STYLE} ${className ?? ''}`.trim();
    const composedCardStyle = `${CARD_BASE_STYLE} ${cardClassName ?? ''}`.trim();

    // RENDER
    return (
        <div
            className={composedLayoutStyle}
            {...props}
        >
            {/* 1. BACKGROUND UNIVERSITY IMAGE WITH AMBIENT OVERLAYS */}
            <img
                src={backgroundImage}
                alt="Pamantasan Campus Background"
                className="absolute inset-0 h-full w-full object-cover object-center scale-105 filter brightness-50 contrast-125"
            />

            {/* AMBIENT GRADIENT OVERLAYS */}
            <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950/90 via-zinc-900/60 to-emerald-950/70 backdrop-blur-sm" />
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

            {/* FLOATING AMBIENT GLOW ORBS */}
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-information/15 blur-3xl pointer-events-none" />

            {/* 2. TOP BRAND & ACTION BAR */}
            {showBrandHeader && (
                <header className="absolute top-0 inset-x-0 p-4 sm:p-6 flex items-center justify-between z-20">
                    <div className="flex items-center gap-3 text-text-inverted">
                        <img
                            src={logoImage}
                            alt="Pamantasan Records Logo"
                            className="h-10 w-10 rounded-full object-cover bg-surface shadow-lg shrink-0"
                        />
                        <span className="font-bold text-sm tracking-wider uppercase">
                            PAMANTASAN RECORDS
                        </span>
                    </div>

                    {headerActions && (
                        <div className="flex items-center gap-2">
                            {headerActions}
                        </div>
                    )}
                </header>
            )}

            {/* 3. CENTER CARD CONTAINER */}
            <main className="relative z-10 max-w-md w-full my-auto">
                <CardContainer className={composedCardStyle}>
                    {/* OPTIONAL BACK BUTTON */}
                    {onBack && (
                        <div>
                            <button
                                type="button"
                                onClick={handleBackClick}
                                className="inline-flex items-center gap-2 text-xs font-medium text-text-muted hover:text-text transition-colors cursor-pointer"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>{backButtonLabel}</span>
                            </button>
                        </div>
                    )}

                    {/* CARD HEADER (ICON, TITLE, DESCRIPTION) */}
                    {(title || description || icon) && (
                        <div className="flex flex-col gap-2">
                            {icon && (
                                <div className="h-12 w-12 rounded-xl bg-accent-background border border-accent-border text-accent flex items-center justify-center mb-1">
                                    {icon}
                                </div>
                            )}
                            {title && (
                                <h1 className="text-2xl font-bold font-serif tracking-tight">
                                    {title}
                                </h1>
                            )}
                            {description && (
                                <p className="text-xs text-text-muted leading-relaxed">
                                    {description}
                                </p>
                            )}
                        </div>
                    )}

                    {/* CARD CONTENT / FORM */}
                    {children}
                </CardContainer>
            </main>

            {/* 4. INSTITUTIONAL FOOTER */}
            {showFooter && (
                <footer className="absolute bottom-4 inset-x-0 text-center text-xs text-text-muted z-20 pointer-events-none px-4">
                    {footer ?? (
                        <span>
                            © 2026 Pamantasan Records. AI-Assisted Document Management System.
                        </span>
                    )}
                </footer>
            )}
        </div>
    );
};

export default AuthenticationLayout;
