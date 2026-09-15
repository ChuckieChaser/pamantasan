// --- IMPORTS ---
import { useState } from 'react';
import {
    X,
    Sun,
    Bell,
    Shield,
    Building2,
    Key,
    Laptop,
    Lock,
    Mail,
    HardDrive,
} from 'lucide-react';
import {
    Badge,
    Button,
    Container,
    SegmentSelection,
    SwitchSelection,
} from '../../components';

// --- CONFIGURATIONS ---
const SETTINGS_SECTIONS = [
    {
        id: 'appearance',
        label: 'Appearance & Theme',
        icon: Sun,
    },
    {
        id: 'notifications',
        label: 'Notification Tiers',
        icon: Bell,
    },
    {
        id: 'security',
        label: 'Security & Sessions',
        icon: Shield,
    },
    {
        id: 'system',
        label: 'Institutional Policy',
        icon: Building2,
    },
];

const THEME_OPTIONS = [
    { value: 'SYSTEM', label: 'System' },
    { value: 'LIGHT', label: 'Light' },
    { value: 'DARK', label: 'Dark' },
];

const NOTIFICATION_SCOPE_OPTIONS = [
    { value: 'ALL', label: 'All Alerts' },
    { value: 'SYSTEM', label: 'System Only' },
    { value: 'IMPORTANT', label: 'Important Only' },
];

// --- COMPONENTS ---
const Settings = ({
    isOpen = false,
    onClose,
    selectedTheme = 'DARK',
    onThemeChange,
    notificationScope = 'ALL',
    onNotificationScopeChange,
    isEmailDigestEnabled = true,
    onToggleEmailDigest,
    isCompactModeEnabled = false,
    onToggleCompactMode,
    currentUser = null,
    className,
    ...props
}) => {
    // GUARD CLAUSES
    if (!isOpen) {
        return null;
    }

    // STATES
    const [activeSection, setActiveSection] = useState('appearance');

    // HANDLERS
    const handleCloseModal = () => {
        onClose?.();
    };

    const handleSelectSection = (sectionId) => {
        setActiveSection(sectionId);
    };

    const handleThemeChange = (newTheme) => {
        onThemeChange?.(newTheme);
    };

    const handleNotificationScopeChange = (newScope) => {
        onNotificationScopeChange?.(newScope);
    };

    const handleToggleEmailDigest = () => {
        onToggleEmailDigest?.();
    };

    const handleToggleCompactMode = () => {
        onToggleCompactMode?.();
    };

    // DERIVED VALUES
    const userDepartment = currentUser?.department ?? 'Records Management Office (RMO)';
    const userEmail = currentUser?.email ?? 'admin.rmo@plpasig.edu.ph';

    // RENDER
    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            {...props}
        >
            <Container
                variant="card"
                className="max-w-5xl w-full p-6 gap-6 bg-surface border-surface-border shadow-2xl flex flex-col animate-toast-in"
            >
                {/* MODAL HEADER */}
                <div className="flex items-center justify-between border-b border-surface-border pb-4 shrink-0">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-base font-bold text-text">
                            System Settings
                        </h2>
                        <span className="text-xs text-text-muted">
                            Preferences, appearance, notifications, and security controls
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleCloseModal}
                        className="h-8 w-8 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                        title="Close modal"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* 2-PANE BODY */}
                <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                    {/* CATEGORIES SIDEBAR */}
                    <div className="w-full md:w-48 shrink-0 flex flex-col gap-1">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-1">
                            Categories
                        </span>
                        {SETTINGS_SECTIONS.map((section) => {
                            const isActive = activeSection === section.id;
                            const IconComponent = section.icon;

                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => handleSelectSection(section.id)}
                                    className={`w-full h-9 px-3 rounded-md flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer ${
                                        isActive
                                            ? 'bg-accent text-text-inverted font-semibold shadow-xs'
                                            : 'text-text-muted hover:text-text hover:bg-surface-hover'
                                    }`}
                                >
                                    <IconComponent className="h-4 w-4 shrink-0" />
                                    <span>{section.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* CONTENT DETAIL PANE */}
                    <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto p-4 rounded-xl bg-surface-hover/30 border border-surface-border">
                        {/* APPEARANCE & THEME */}
                        {activeSection === 'appearance' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1 border-b border-surface-border pb-3">
                                    <h3 className="text-sm font-bold text-text">
                                        Appearance & Interface Theme
                                    </h3>
                                    <p className="text-xs text-text-muted">
                                        Configure visual tone, dark mode defaults, and workspace control density.
                                    </p>
                                </div>

                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <span className="text-sm font-semibold text-text">
                                            Interface Theme
                                        </span>
                                        <span className="text-xs text-text-muted leading-relaxed">
                                            Select light, dark, or automatic system visual preference.
                                        </span>
                                    </div>

                                    <div className="shrink-0">
                                        <SegmentSelection
                                            value={selectedTheme}
                                            options={THEME_OPTIONS}
                                            onChange={handleThemeChange}
                                        />
                                    </div>
                                </div>

                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex items-center justify-between gap-4">
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <span className="text-sm font-semibold text-text">
                                            Compact Workspace Layout
                                        </span>
                                        <span className="text-xs text-text-muted leading-relaxed">
                                            Condense table row paddings and control gaps for dense records.
                                        </span>
                                    </div>

                                    <div className="shrink-0">
                                        <SwitchSelection
                                            checked={isCompactModeEnabled}
                                            onChange={handleToggleCompactMode}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* NOTIFICATION TIERS */}
                        {activeSection === 'notifications' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1 border-b border-surface-border pb-3">
                                    <h3 className="text-sm font-bold text-text">
                                        Notification Preferences
                                    </h3>
                                    <p className="text-xs text-text-muted">
                                        Manage delivery rules, urgent notifications, and summary digest frequency.
                                    </p>
                                </div>

                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <span className="text-sm font-semibold text-text">
                                            Notification Delivery Scope
                                        </span>
                                        <span className="text-xs text-text-muted leading-relaxed">
                                            Choose whether to receive all updates, system notices, or urgent only.
                                        </span>
                                    </div>

                                    <div className="shrink-0">
                                        <SegmentSelection
                                            value={notificationScope}
                                            options={NOTIFICATION_SCOPE_OPTIONS}
                                            onChange={handleNotificationScopeChange}
                                        />
                                    </div>
                                </div>

                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex items-center justify-between gap-4">
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <span className="text-sm font-semibold text-text">
                                            Daily Activity Digest Email
                                        </span>
                                        <span className="text-xs text-text-muted leading-relaxed">
                                            Send end-of-day summary of pending approval queues to {userEmail}.
                                        </span>
                                    </div>

                                    <div className="shrink-0">
                                        <SwitchSelection
                                            checked={isEmailDigestEnabled}
                                            onChange={handleToggleEmailDigest}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECURITY & SESSIONS */}
                        {activeSection === 'security' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1 border-b border-surface-border pb-3">
                                    <h3 className="text-sm font-bold text-text">
                                        Security & Active Sessions
                                    </h3>
                                    <p className="text-xs text-text-muted">
                                        Manage credential authentication, password policies, and login sessions.
                                    </p>
                                </div>

                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-surface-hover border border-surface-border text-accent">
                                            <Key className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-text">
                                                University ID Password
                                            </span>
                                            <span className="text-xs text-text-muted">
                                                Last rotated during semester enrollment.
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        variant="secondary"
                                        label="Change Password"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-semibold text-text uppercase tracking-wider">
                                        Active Sessions
                                    </span>

                                    <div className="p-4 rounded-lg bg-surface border border-surface-border flex items-center justify-between gap-4 text-xs">
                                        <div className="flex items-center gap-3">
                                            <Laptop className="h-5 w-5 text-accent" />
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-text">
                                                    Current Session · Chrome on Windows
                                                </span>
                                                <span className="text-text-muted">
                                                    IP: 192.168.1.45 · Authenticated via Institutional SSO
                                                </span>
                                            </div>
                                        </div>
                                        <Badge
                                            variant="success"
                                            label="Active Now"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* INSTITUTIONAL POLICY */}
                        {activeSection === 'system' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1 border-b border-surface-border pb-3">
                                    <h3 className="text-sm font-bold text-text">
                                        Institutional Record Policy
                                    </h3>
                                    <p className="text-xs text-text-muted">
                                        Compliance and preservation rules across university colleges.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-2">
                                        <div className="flex items-center gap-2 font-semibold text-text">
                                            <Lock className="h-4 w-4 text-accent" />
                                            <span>Encryption Standard</span>
                                        </div>
                                        <span className="text-text-muted leading-relaxed">
                                            AES-256 GCM Cloud Storage with university access controls.
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-2">
                                        <div className="flex items-center gap-2 font-semibold text-text">
                                            <Mail className="h-4 w-4 text-accent" />
                                            <span>Domain Enforcement</span>
                                        </div>
                                        <span className="text-text-muted leading-relaxed">
                                            Restricted to official @plpasig.edu.ph institutional addresses.
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-2">
                                        <div className="flex items-center gap-2 font-semibold text-text">
                                            <HardDrive className="h-4 w-4 text-accent" />
                                            <span>Retention Schedule</span>
                                        </div>
                                        <span className="text-text-muted leading-relaxed">
                                            10-year archival retention with automated checksum verification.
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-2">
                                        <div className="flex items-center gap-2 font-semibold text-text">
                                            <Building2 className="h-4 w-4 text-accent" />
                                            <span>Connected College</span>
                                        </div>
                                        <span className="text-text-muted leading-relaxed">
                                            {userDepartment}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* MODAL FOOTER */}
                <div className="flex items-center justify-end border-t border-surface-border pt-4 shrink-0">
                    <Button
                        variant="secondary"
                        label="Close"
                        onClick={handleCloseModal}
                    />
                </div>
            </Container>
        </div>
    );
};

// --- EXPORTS ---
export { Settings };
