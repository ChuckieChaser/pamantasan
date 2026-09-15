// --- IMPORTS ---
import { useState, useEffect } from 'react';
import {
    X,
    Sliders,
    Shield,
    Key,
    Globe,
    Laptop,
    Smartphone,
    RefreshCw,
    Palette,
    Bell,
    Monitor,
    UserCircle,
    AlertTriangle,
} from 'lucide-react';
import { Button } from '../Button';
import { Container } from '../Container';
import { Modal } from '../Modal';
import { PasswordField } from '../Fields';
import { SegmentSelection } from '../Selections';
import { authService, userService } from '../../services';
import { useToast } from '../../hooks';
import { constants } from '../../constants';

// --- CONFIGURATIONS ---
const DONT_SHOW_SSO_KEY_PREFIX = 'pamantasan_skip_sso_onboarding_';

const SETTINGS_SECTIONS = [
    {
        id: 'preferences',
        label: 'Preferences',
        icon: Sliders,
    },
    {
        id: 'security',
        label: 'Security',
        icon: Shield,
    },
];

const THEME_OPTIONS = [
    { value: constants.USER_SETTINGS_THEME.SYSTEM, label: 'SYSTEM' },
    { value: constants.USER_SETTINGS_THEME.LIGHT, label: 'LIGHT' },
    { value: constants.USER_SETTINGS_THEME.DARK, label: 'DARK' },
];

const NOTIFICATION_OPTIONS = [
    { value: constants.USER_SETTINGS_NOTIFICATION.ALL, label: 'ALL' },
    { value: constants.USER_SETTINGS_NOTIFICATION.SYSTEM, label: 'SYSTEM' },
    { value: constants.USER_SETTINGS_NOTIFICATION.IMPORTANT, label: 'IMPORTANT' },
];

const AVATAR_OPTIONS = constants.USER_SETTINGS_AVATAR_OPTIONS ?? [
    { value: constants.USER_SETTINGS_AVATAR?.SYSTEM ?? 'SYSTEM', label: 'SYSTEM' },
    { value: constants.USER_SETTINGS_AVATAR?.GOOGLE ?? 'GOOGLE', label: 'GOOGLE' },
];

// --- COMPONENTS ---
const Settings = ({
    isOpen = false,
    onClose,
    selectedTheme = constants.USER_SETTINGS_THEME.SYSTEM,
    onThemeChange,
    notificationScope = constants.USER_SETTINGS_NOTIFICATION.ALL,
    onNotificationScopeChange,
    currentUser = null,
    onSignOut,
    className,
    ...props
}) => {
    // GUARD CLAUSES
    if (!isOpen) {
        return null;
    }

    // STATES
    const [activeSection, setActiveSection] = useState('preferences');
    const [sessions, setSessions] = useState([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState(null);

    // GOOGLE SSO LINKING STATES
    const [linkedGoogleId, setLinkedGoogleId] = useState(null);
    const [isLoadingGoogleCreds, setIsLoadingGoogleCreds] = useState(false);
    const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
    const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);
    const [avatarSource, setAvatarSource] = useState(() => {
        if (typeof localStorage !== 'undefined' && currentUser?.id) {
            return localStorage.getItem(`pamantasan_avatar_source_${currentUser.id}`) || constants.USER_SETTINGS_AVATAR.SYSTEM;
        }
        return constants.USER_SETTINGS_AVATAR.SYSTEM;
    });

    const isVerifiedOrLinked = currentUser?.status === constants.USERS_STATUS.VERIFIED || Boolean(linkedGoogleId);

    // SYNC USER SETTINGS FROM SERVER
    useEffect(() => {
        if (!isOpen || !currentUser?.id) return;

        userService.fetchUserSettingsByUserId(currentUser.id).then((settings) => {
            if (settings?.avatar) {
                setAvatarSource(settings.avatar);
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(`pamantasan_avatar_source_${currentUser.id}`, settings.avatar);
                }
            }
        }).catch(() => {});
    }, [isOpen, currentUser?.id]);

    const handleAvatarSourceChange = (newSource) => {
        if (!isVerifiedOrLinked) return;
        setAvatarSource(newSource);
        if (typeof localStorage !== 'undefined' && currentUser?.id) {
            localStorage.setItem(`pamantasan_avatar_source_${currentUser.id}`, newSource);
            window.dispatchEvent(new Event('pamantasan-avatar-changed'));
        }
        if (currentUser?.id) {
            userService.upsertUserSetting(currentUser.id, { avatar: newSource }).catch((err) => {
                console.warn('Failed to update avatar setting in database:', err);
            });
        }
    };

    const [dontShowSSOOnLogin, setDontShowSSOOnLogin] = useState(() => {
        if (typeof localStorage !== 'undefined' && currentUser?.id) {
            return localStorage.getItem(`${DONT_SHOW_SSO_KEY_PREFIX}${currentUser.id}`) === 'true';
        }
        return false;
    });

    useEffect(() => {
        if (typeof localStorage !== 'undefined' && currentUser?.id) {
            setDontShowSSOOnLogin(
                localStorage.getItem(`${DONT_SHOW_SSO_KEY_PREFIX}${currentUser.id}`) === 'true'
            );
        }
    }, [currentUser?.id]);

    const handleToggleDontShowSSO = (e) => {
        const checked = e.target.checked;
        setDontShowSSOOnLogin(checked);
        if (typeof localStorage !== 'undefined' && currentUser?.id) {
            if (checked) {
                localStorage.setItem(`${DONT_SHOW_SSO_KEY_PREFIX}${currentUser.id}`, 'true');
            } else {
                localStorage.removeItem(`${DONT_SHOW_SSO_KEY_PREFIX}${currentUser.id}`);
            }
        }
    };

    // PASSWORD MODAL STATES
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState({});
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

    // DESTRUCTIVE CONFIRMATION MODAL STATES
    const [terminatingSession, setTerminatingSession] = useState(null);
    const [isTerminatingSession, setIsTerminatingSession] = useState(false);
    const [isConfirmingUnlinkGoogle, setIsConfirmingUnlinkGoogle] = useState(false);

    // HOOKS
    const { showToast } = useToast();

    // LOAD ACTIVE SESSIONS
    const loadSessions = async () => {
        if (!currentUser?.id) return;
        setIsLoadingSessions(true);
        try {
            const userSessions = await userService.fetchUserSessionsByUserId(currentUser.id);
            setSessions(userSessions || []);
            const activeId = authService.getCurrentSessionId();
            setCurrentSessionId(activeId);
        } catch (error) {
            console.warn('Failed to fetch user sessions:', error);
        } finally {
            setIsLoadingSessions(false);
        }
    };

    // LOAD USER CREDENTIALS FOR GOOGLE SSO
    const loadUserCredentials = async () => {
        if (!currentUser?.id) return;
        setIsLoadingGoogleCreds(true);
        try {
            const creds = await userService.fetchUserCredentialsByUserId(currentUser.id);
            setLinkedGoogleId(creds?.googleId ?? null);
        } catch (error) {
            console.warn('Failed to fetch user credentials:', error);
        } finally {
            setIsLoadingGoogleCreds(false);
        }
    };

    useEffect(() => {
        if (isOpen && activeSection === 'security') {
            loadSessions();
            loadUserCredentials();
        }
    }, [isOpen, activeSection, currentUser?.id]);

    // HANDLERS
    const handleCloseModal = () => {
        onClose?.();
    };

    const handleSelectSection = (sectionId) => {
        setActiveSection(sectionId);
    };

    const handleLinkGoogle = async () => {
        if (!currentUser?.email) {
            showToast({
                variant: 'error',
                title: 'Action Failed',
                description: 'Email missing.',
            });
            return;
        }

        setIsLinkingGoogle(true);

        try {
            const result = await authService.linkGoogleAccount(currentUser.email);
            setLinkedGoogleId(result.googleId);
            showToast({
                variant: 'success',
                title: 'Google SSO Linked',
                description: 'Account linked successfully.',
            });
        } catch (error) {
            let desc = 'Link failed.';
            if (error?.message?.includes('mismatch')) {
                desc = 'Account email mismatch.';
            } else if (error?.message?.includes('cancelled') || error?.code === 'auth/popup-closed-by-user') {
                desc = 'Linking cancelled.';
            } else if (error?.message) {
                desc = error.message;
            }
            showToast({
                variant: 'error',
                title: 'Linking Failed',
                description: desc,
            });
        } finally {
            setIsLinkingGoogle(false);
        }
    };

    const handleUnlinkGoogle = async () => {
        if (!currentUser?.id) return;

        setIsUnlinkingGoogle(true);

        try {
            await authService.unlinkGoogleAccount(currentUser.id);
            setLinkedGoogleId(null);
            showToast({
                variant: 'information',
                title: 'Google SSO Unlinked',
                description: 'Account unlinked successfully.',
            });
        } catch (error) {
            showToast({
                variant: 'error',
                title: 'Unlink Failed',
                description: error?.message || 'Unlink failed.',
            });
        } finally {
            setIsUnlinkingGoogle(false);
        }
    };

    const handleThemeChange = (newTheme) => {
        onThemeChange?.(newTheme);
    };

    const handleNotificationScopeChange = (newScope) => {
        onNotificationScopeChange?.(newScope);
    };

    const handleOpenPasswordModal = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordErrors({});
        setIsPasswordModalOpen(true);
    };

    const handleClosePasswordModal = () => {
        if (!isSubmittingPassword) {
            setIsPasswordModalOpen(false);
            setPasswordErrors({});
        }
    };

    const handleChangePasswordSubmit = async (event) => {
        event?.preventDefault?.();
        const errors = {};

        if (!currentPassword) {
            errors.currentPassword = 'Current password is required.';
        }

        if (!newPassword) {
            errors.newPassword = 'New password is required.';
        } else if (newPassword.length < 8) {
            errors.newPassword = 'Must be at least 8 characters.';
        } else if (newPassword === currentPassword) {
            errors.newPassword = 'Must differ from current.';
        }

        if (!confirmPassword) {
            errors.confirmPassword = 'Confirm your password.';
        } else if (newPassword && confirmPassword !== newPassword) {
            errors.confirmPassword = 'Passwords do not match.';
        }

        if (Object.keys(errors).length > 0) {
            setPasswordErrors(errors);
            return;
        }

        setIsSubmittingPassword(true);
        setPasswordErrors({});

        try {
            await authService.changePassword(currentPassword, newPassword);
            showToast({
                variant: 'success',
                title: 'Password Updated',
                description: 'Password changed.',
            });
            setIsPasswordModalOpen(false);
        } catch (error) {
            const msg = error?.message ?? 'Failed to update password.';
            if (msg.toLowerCase().includes('current')) {
                setPasswordErrors({ currentPassword: msg });
            } else {
                setPasswordErrors({ newPassword: msg });
            }
        } finally {
            setIsSubmittingPassword(false);
        }
    };

    const handleLogoutSession = (session) => {
        const isCurrent = session.id === currentSessionId || sessions.length === 1;

        if (isCurrent) {
            onClose?.();
            if (onSignOut) {
                onSignOut();
            } else {
                authService.logout();
            }
            return;
        }

        setTerminatingSession(session);
    };

    const handleConfirmTerminateSession = async () => {
        if (!terminatingSession?.id) return;

        setIsTerminatingSession(true);
        try {
            await userService.deleteUserSession(terminatingSession.id);
            showToast({
                variant: 'success',
                title: 'Session Terminated',
                description: 'Remote device session ended.',
            });
            loadSessions();
            setTerminatingSession(null);
        } catch (error) {
            showToast({
                variant: 'error',
                title: 'Revocation Failed',
                description: error?.message ?? 'Revocation failed.',
            });
        } finally {
            setIsTerminatingSession(false);
        }
    };

    // RENDER
    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    handleCloseModal();
                }
            }}
            {...props}
        >
            <Container
                variant="card"
                className="max-w-5xl w-full h-[620px] max-h-[90vh] p-6 gap-6 bg-surface border-surface-border shadow-2xl flex flex-col animate-toast-in overflow-hidden"
            >
                {/* MODAL HEADER: [ icon ] [ header ] */}
                <div className="flex items-center justify-between border-b border-surface-border pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-accent-background text-accent shrink-0">
                            <Sliders className="h-5 w-5 shrink-0" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-base font-bold text-text font-serif">
                                System Settings
                            </h2>
                            <span className="text-xs text-text-muted">
                                Preferences and account security controls
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCloseModal}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
                        title="Close modal"
                        aria-label="Close modal"
                    >
                        <X className="h-4 w-4 shrink-0" />
                    </button>
                </div>

                {/* 2-PANE BODY */}
                <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
                    {/* CATEGORIES SIDEBAR */}
                    <div className="w-full md:w-48 shrink-0 flex flex-col gap-1 overflow-y-auto pr-1">
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
                        {/* PREFERENCES (THEME & NOTIFICATION CONSOLIDATED) */}
                        {activeSection === 'preferences' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1 border-b border-surface-border pb-3">
                                    <h3 className="text-sm font-bold text-text">
                                        Preferences
                                    </h3>
                                    <p className="text-xs text-text-muted">
                                        Manage personal appearance and institutional notification delivery.
                                    </p>
                                </div>

                                {/* THEME */}
                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg bg-surface-hover border border-surface-border text-accent shrink-0 mt-0.5">
                                            <Palette className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                            <span className="text-sm font-semibold text-text">
                                                Theme
                                            </span>
                                            <span className="text-xs text-text-muted leading-relaxed">
                                                Select visual appearance standard.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="shrink-0 sm:pt-1">
                                        <SegmentSelection
                                            value={selectedTheme}
                                            options={THEME_OPTIONS}
                                            onChange={handleThemeChange}
                                        />
                                    </div>
                                </div>

                                {/* NOTIFICATION */}
                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg bg-surface-hover border border-surface-border text-accent shrink-0 mt-0.5">
                                            <Bell className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                            <span className="text-sm font-semibold text-text">
                                                Notification
                                            </span>
                                            <span className="text-xs text-text-muted leading-relaxed">
                                                Choose institutional alert priority and delivery scope.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="shrink-0 sm:pt-1">
                                        <SegmentSelection
                                            value={notificationScope}
                                            options={NOTIFICATION_OPTIONS}
                                            onChange={handleNotificationScopeChange}
                                        />
                                    </div>
                                </div>

                                {/* AVATAR SOURCE */}
                                <div className={`p-4 rounded-lg bg-surface border border-surface-border flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${!isVerifiedOrLinked ? 'opacity-50' : ''}`}>
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg bg-surface-hover border border-surface-border text-accent shrink-0 mt-0.5">
                                            <UserCircle className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                            <span className="text-sm font-semibold text-text">
                                                Avatar
                                            </span>
                                            <span className="text-xs text-text-muted leading-relaxed">
                                                {isVerifiedOrLinked
                                                    ? 'Choose profile photo source.'
                                                    : 'Requires a verified account or linked Google SSO.'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="shrink-0 sm:pt-1">
                                        <SegmentSelection
                                            value={isVerifiedOrLinked ? avatarSource : 'SYSTEM'}
                                            options={AVATAR_OPTIONS}
                                            onChange={handleAvatarSourceChange}
                                            isDisabled={!isVerifiedOrLinked}
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
                                        Security & Sessions
                                    </h3>
                                    <p className="text-xs text-text-muted">
                                        Manage account authentication credentials and active sessions.
                                    </p>
                                </div>

                                {/* PASSWORD ROW */}
                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="p-2 rounded-lg bg-surface-hover border border-surface-border text-accent shrink-0 mt-0.5">
                                            <Key className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                            <span className="text-sm font-semibold text-text">
                                                Password
                                            </span>
                                            <span className="text-xs text-text-muted leading-relaxed">
                                                Manage account authentication credential.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="shrink-0 pt-0.5">
                                        <Button
                                            variant="secondary"
                                            label="Change Password"
                                            onClick={handleOpenPasswordModal}
                                        />
                                    </div>
                                </div>

                                {/* GOOGLE SINGLE SIGN ON (SSO) ROW */}
                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-3">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className="p-2 rounded-lg bg-surface-hover border border-surface-border text-accent shrink-0 mt-0.5">
                                                <Globe className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col min-w-0 flex-1 gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-text">
                                                        Google Single Sign On (SSO)
                                                    </span>
                                                    {isLoadingGoogleCreds ? (
                                                        <span className="text-[10px] text-text-muted">Loading...</span>
                                                    ) : linkedGoogleId ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            LINKED
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-hover text-text-muted border border-surface-border">
                                                            NOT LINKED
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-text-muted leading-relaxed">
                                                    {linkedGoogleId
                                                        ? `Linked to institutional account (${currentUser?.email || 'university email'}).`
                                                        : `Link your registered university email (${currentUser?.email || '—'}) for Single Sign-On.`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="shrink-0 flex items-center gap-2 pt-0.5">
                                            {linkedGoogleId ? (
                                                <Button
                                                    variant="secondary"
                                                    label={isUnlinkingGoogle ? 'Unlinking...' : 'Unlink'}
                                                    onClick={() => setIsConfirmingUnlinkGoogle(true)}
                                                    isLoading={isUnlinkingGoogle}
                                                    disabled={isUnlinkingGoogle || isLinkingGoogle || isLoadingGoogleCreds}
                                                />
                                            ) : (
                                                <Button
                                                    variant="primary"
                                                    label={isLinkingGoogle ? 'Connecting...' : 'Link Google Account'}
                                                    onClick={handleLinkGoogle}
                                                    isLoading={isLinkingGoogle}
                                                    disabled={isLinkingGoogle || isUnlinkingGoogle || isLoadingGoogleCreds}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Don't show this on login (only visible when not linked - saved in localStorage for this PC) */}
                                    {!linkedGoogleId && (
                                        <label className="flex items-center gap-2 pt-3 border-t border-surface-border text-xs text-text-muted cursor-pointer hover:text-text transition-colors select-none">
                                            <input
                                                type="checkbox"
                                                checked={dontShowSSOOnLogin}
                                                onChange={handleToggleDontShowSSO}
                                                className="rounded border-surface-border text-accent focus:ring-accent accent-accent h-4 w-4"
                                            />
                                            <span>Don't show SSO on login for this PC</span>
                                        </label>
                                    )}
                                </div>

                                {/* SESSIONS CONTAINER */}
                                <div className="p-4 rounded-lg bg-surface border border-surface-border flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-3">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className="p-2 rounded-lg bg-surface-hover border border-surface-border text-accent shrink-0 mt-0.5">
                                                <Monitor className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                <span className="text-sm font-semibold text-text">
                                                    Sessions
                                                </span>
                                                <span className="text-xs text-text-muted leading-relaxed">
                                                    Manage active browser sessions across your devices.
                                                </span>
                                            </div>
                                        </div>

                                        <div className="shrink-0 pt-0.5">
                                            <Button
                                                variant="secondary"
                                                leadingIcon={RefreshCw}
                                                label="Refresh"
                                                onClick={loadSessions}
                                                isLoading={isLoadingSessions}
                                                isDisabled={isLoadingSessions}
                                                className="h-8 text-xs px-2.5"
                                            />
                                        </div>
                                    </div>

                                    {isLoadingSessions && sessions.length === 0 ? (
                                        <div className="py-4 text-center text-xs text-text-muted">
                                            Loading active sessions...
                                        </div>
                                    ) : sessions.length === 0 ? (
                                        <div className="py-4 text-center text-xs text-text-muted">
                                            No active session records found.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {sessions.map((session) => {
                                                const isCurrent = session.id === currentSessionId || sessions.length === 1;
                                                const isMobile = /Android|iPhone|iPad|iOS/i.test(session.userAgent || '');
                                                const DeviceIcon = isMobile ? Smartphone : Laptop;

                                                return (
                                                    <div
                                                        key={session.id || session.tokenHash}
                                                        className="p-3 rounded-lg bg-surface-hover/50 border border-surface-border flex items-center justify-between gap-4 text-xs"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <DeviceIcon className="h-5 w-5 text-accent shrink-0" />
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-text truncate">
                                                                    {session.userAgent || 'Web Browser on Windows'}
                                                                </span>
                                                                <span className="text-text-muted truncate">
                                                                    IP: {session.ipAddress || '127.0.0.1'} · Logged in {formatSessionDate(session.createdAt)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 shrink-0">
                                                            {isCurrent && (
                                                                <span
                                                                    className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shrink-0"
                                                                    title="Current session"
                                                                />
                                                            )}

                                                            <Button
                                                                variant="secondary"
                                                                size="small"
                                                                label="Log Out"
                                                                onClick={() => handleLogoutSession(session)}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
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

            {/* FUNCTIONAL CHANGE PASSWORD MODAL */}
            {isPasswordModalOpen && (
                <Modal
                    isOpen={isPasswordModalOpen}
                    onClose={handleClosePasswordModal}
                    title="Change Password"
                    description="Enter your current password and choose a new password."
                    icon={Key}
                    callout="New password must be at least 8 characters long and differ from your current password."
                    calloutVariant="neutral"
                    onConfirm={handleChangePasswordSubmit}
                    confirmLabel={isSubmittingPassword ? 'Updating...' : 'Update Password'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isSubmittingPassword}
                    isConfirmDisabled={isSubmittingPassword}
                >
                    <form onSubmit={handleChangePasswordSubmit} className="flex flex-col gap-4 py-2">
                        <PasswordField
                            label="Current Password"
                            value={currentPassword}
                            onChange={(event) => {
                                setCurrentPassword(event.target.value);
                                if (passwordErrors.currentPassword) setPasswordErrors((prev) => ({ ...prev, currentPassword: undefined }));
                            }}
                            placeholder="Enter your current password"
                            leadingIcon={Key}
                            required
                            error={passwordErrors.currentPassword}
                        />

                        <PasswordField
                            label="New Password"
                            value={newPassword}
                            onChange={(event) => {
                                setNewPassword(event.target.value);
                                if (passwordErrors.newPassword) setPasswordErrors((prev) => ({ ...prev, newPassword: undefined }));
                            }}
                            placeholder="Enter your new password"
                            helperText="At least 8 characters"
                            leadingIcon={Key}
                            required
                            error={passwordErrors.newPassword}
                        />

                        <PasswordField
                            label="Confirm New Password"
                            value={confirmPassword}
                            onChange={(event) => {
                                setConfirmPassword(event.target.value);
                                if (passwordErrors.confirmPassword) setPasswordErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                            }}
                            placeholder="Enter your confirm new password"
                            leadingIcon={Key}
                            required
                            error={passwordErrors.confirmPassword}
                        />
                    </form>
                </Modal>
            )}

            {/* TERMINATE SESSION CONFIRMATION MODAL */}
            {terminatingSession && (
                <Modal
                    isOpen={Boolean(terminatingSession)}
                    onClose={() => !isTerminatingSession && setTerminatingSession(null)}
                    title="Terminate Device Session"
                    description={`Are you sure you want to terminate the active session on ${terminatingSession.userAgent || 'this device'}?`}
                    icon={AlertTriangle}
                    variant="destructive"
                    size="sm"
                    callout={`IP Address: ${terminatingSession.ipAddress || '127.0.0.1'} · Started ${formatSessionDate(terminatingSession.createdAt)}. The user on that device will be immediately logged out.`}
                    calloutVariant="destructive"
                    onConfirm={handleConfirmTerminateSession}
                    confirmLabel={isTerminatingSession ? 'Terminating...' : 'Terminate Session'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isTerminatingSession}
                    isConfirmDisabled={isTerminatingSession}
                />
            )}

            {/* UNLINK GOOGLE SSO CONFIRMATION MODAL */}
            {isConfirmingUnlinkGoogle && (
                <Modal
                    isOpen={isConfirmingUnlinkGoogle}
                    onClose={() => !isUnlinkingGoogle && setIsConfirmingUnlinkGoogle(false)}
                    title="Unlink Google Account"
                    description="Are you sure you want to disconnect your Google Single Sign-On account from your institutional profile?"
                    icon={AlertTriangle}
                    variant="destructive"
                    size="sm"
                    callout="You will no longer be able to sign in using Google SSO or Google One Tap. You will need your university identification password to access your account."
                    calloutVariant="destructive"
                    onConfirm={async () => {
                        await handleUnlinkGoogle();
                        setIsConfirmingUnlinkGoogle(false);
                    }}
                    confirmLabel={isUnlinkingGoogle ? 'Unlinking...' : 'Unlink Google Account'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isUnlinkingGoogle}
                    isConfirmDisabled={isUnlinkingGoogle}
                />
            )}
        </div>
    );
};

// --- HELPERS ---
function formatSessionDate(dateString) {
    if (!dateString) return 'recently';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return dateString;
    }
}

// --- EXPORTS ---
export { Settings };
export default Settings;
