// --- IMPORTS ---
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Key,
    Globe,
    ArrowRight,
    ShieldCheck,
    PenTool,
    UploadCloud,
    Trash2,
    RefreshCw,
    CheckCircle2,
    Sparkles,
} from 'lucide-react';
import { AuthLayout } from '../layouts';
import { Button, PasswordField } from '../components';
import { useAuth, useToast } from '../hooks';
import { authService, storageService } from '../services';
import { useUserStore } from '../stores';
import { constants } from '../constants';


// --- HELPERS ---
const formatFileSize = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};


// --- COMPONENTS ---
const OnboardingPage = ({
    currentUser: propUser = null,
    onComplete = null,
}) => {
    // HOOKS
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { currentUser: authUser, isLoading: isAuthLoading } = useAuth();

    // RESOLVE ACTIVE USER
    const activeUser = propUser || authUser;
    const activeUserId = activeUser?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('pamantasan_auth_user_id') : null);
    const targetEmail = activeUser?.email || (typeof localStorage !== 'undefined' ? localStorage.getItem('pamantasan_auth_user_email') : null);

    // DERIVED STATUS & STEP ORDER
    // Standard roles: PENDING_PASSWORD -> PENDING_SSO
    // Officer role:   PENDING_PASSWORD -> PENDING_SIGNATURE -> PENDING_SSO
    const currentStatus = activeUser?.status ?? constants.USERS_STATUS.VERIFIED;
    const isPendingPassword = currentStatus === constants.USERS_STATUS.PENDING_PASSWORD;
    const isPendingSignature = !isPendingPassword && (
        currentStatus === constants.USERS_STATUS.PENDING_SIGNATURE ||
        (
            constants.isOfficerRole(activeUser?.role) &&
            !activeUser?.signaturePath &&
            currentStatus !== constants.USERS_STATUS.SUSPENDED
        )
    );
    const isPendingSSO = !isPendingPassword && !isPendingSignature && currentStatus === constants.USERS_STATUS.PENDING_SSO;

    // STATES FOR PASSWORD SETUP
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState({});
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

    // STATES FOR OFFICER SIGNATURE SETUP
    const signatureInputRef = useRef(null);
    const [signatureFile, setSignatureFile] = useState(null);
    const [signaturePreviewUrl, setSignaturePreviewUrl] = useState(null);
    const [isProcessingSignature, setIsProcessingSignature] = useState(false);
    const [isDraggingSignature, setIsDraggingSignature] = useState(false);
    const [signatureError, setSignatureError] = useState('');
    const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);

    // STATES FOR SSO LINKING
    const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    // CLEANUP PREVIEW OBJECT URL
    useEffect(() => {
        return () => {
            if (signaturePreviewUrl && signaturePreviewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(signaturePreviewUrl);
            }
        };
    }, [signaturePreviewUrl]);

    // AUTO-REDIRECT
    useEffect(() => {
        if (isAuthLoading && !activeUser) {
            return;
        }

        if (!activeUser && !activeUserId) {
            navigate('/login', { replace: true });
            return;
        }

        if (currentStatus === constants.USERS_STATUS.VERIFIED && !isPendingSignature) {
            navigate('/dashboard', { replace: true });
            return;
        }

        if (isPendingSSO && activeUserId) {
            const hasSkipped = authService.hasSkippedSSOOnboarding(activeUserId);
            if (hasSkipped) {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [activeUser, activeUserId, currentStatus, isPendingSignature, isPendingSSO, isAuthLoading, navigate]);

    // HANDLER: BACK BUTTON (PERSISTS COMPLETED STATUS & RETURNS TO LOGIN)
    const handleBackToLogin = async () => {
        try {
            await authService.logout();
        } catch (error) {
            console.warn('Error signing out during onboarding back navigation:', error);
        }
        navigate('/login', { state: { isLogout: true }, replace: true });
    };

    // HANDLERS: PASSWORD CHANGE
    const handlePasswordSubmit = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const errors = {};
        if (!currentPassword) {
            errors.current = 'Temporary password is required.';
        }
        if (!newPassword) {
            errors.new = 'New password is required.';
        } else if (newPassword.length < 8) {
            errors.new = 'Must be at least 8 characters.';
        } else if (newPassword === currentPassword) {
            errors.new = 'Must be different from temporary password.';
        }
        if (!confirmPassword) {
            errors.confirm = 'Confirm password is required.';
        } else if (newPassword && newPassword !== confirmPassword) {
            errors.confirm = 'Passwords do not match.';
        }

        if (Object.keys(errors).length > 0) {
            setPasswordErrors(errors);
            return;
        }

        setPasswordErrors({});
        setIsSubmittingPassword(true);

        try {
            await authService.changePassword(currentPassword, newPassword);
            useUserStore.getState().fetchUsers(true).catch(() => {});
            showToast({
                title: 'Password Updated',
                description: constants.isOfficerRole(activeUser?.role) && !activeUser?.signaturePath
                    ? 'Password saved. Please upload your official signature next.'
                    : 'Password updated successfully.',
                variant: 'success',
            });
            // Automatically advances to PENDING_SIGNATURE (for Officer) or PENDING_SSO (for standard roles)
        } catch (error) {
            const message = error?.message || 'Failed to update password.';
            setPasswordErrors({ current: message });
            showToast({
                title: 'Password Update Failed',
                description: message,
                variant: 'error',
            });
        } finally {
            setIsSubmittingPassword(false);
        }
    };

    // HANDLERS: OFFICER SIGNATURE UPLOAD & TRANSPARENT PROCESSING
    const handleStageSignatureFile = async (rawFile) => {
        if (!rawFile) return;

        if (!rawFile.type || !rawFile.type.startsWith('image/')) {
            setSignatureError('Please select a valid image file (PNG, JPG, or WEBP).');
            return;
        }

        if (rawFile.size > 10 * 1024 * 1024) {
            setSignatureError('Signature image must be smaller than 10 MB.');
            return;
        }

        setSignatureError('');
        setIsProcessingSignature(true);

        try {
            const processedPngFile = await storageService.processSignatureToTransparentPng(rawFile);
            const nextPreviewUrl = URL.createObjectURL(processedPngFile);

            setSignaturePreviewUrl((prev) => {
                if (prev && prev.startsWith('blob:')) {
                    URL.revokeObjectURL(prev);
                }
                return nextPreviewUrl;
            });
            setSignatureFile(processedPngFile);
        } catch (error) {
            console.error('Failed to process signature image:', error);
            setSignatureError(error?.message || 'Could not process signature image. Please try another photo.');
        } finally {
            setIsProcessingSignature(false);
            if (signatureInputRef.current) {
                signatureInputRef.current.value = '';
            }
        }
    };

    const handleClearSignature = () => {
        setSignatureFile(null);
        setSignatureError('');
        setSignaturePreviewUrl((prev) => {
            if (prev && prev.startsWith('blob:')) {
                URL.revokeObjectURL(prev);
            }
            return null;
        });
        if (signatureInputRef.current) {
            signatureInputRef.current.value = '';
        }
    };

    const handleSignatureSubmit = async (event) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (!signatureFile) {
            setSignatureError('Your official signature is required before you can proceed.');
            return;
        }

        setSignatureError('');
        setIsSubmittingSignature(true);

        try {
            const updatedUser = await authService.completeSignatureOnboarding(signatureFile);
            useUserStore.getState().fetchUsers(true).catch(() => {});
            showToast({
                title: 'Official Signature Saved',
                description: 'Your transparent digital signature has been registered.',
                variant: 'success',
            });

            if (updatedUser?.status === constants.USERS_STATUS.VERIFIED) {
                if (onComplete) {
                    await onComplete();
                } else {
                    navigate('/dashboard', { replace: true });
                }
            }
            // Otherwise, currentStatus is now PENDING_SSO and the view advances to Google SSO Linking
        } catch (error) {
            const message = error?.message || 'Failed to upload official signature.';
            setSignatureError(message);
            showToast({
                title: 'Signature Upload Failed',
                description: message,
                variant: 'error',
            });
        } finally {
            setIsSubmittingSignature(false);
        }
    };

    // HANDLERS: SSO LINKING
    const handleLinkGoogle = async () => {
        if (!targetEmail) {
            showToast({
                title: 'Linking Failed',
                description: 'Email missing.',
                variant: 'error',
            });
            return;
        }

        setIsLinkingGoogle(true);

        try {
            await authService.linkGoogleAccount(targetEmail);
            useUserStore.getState().fetchUsers(true).catch(() => {});
            showToast({
                title: 'Google SSO Linked',
                description: 'Account linked successfully.',
                variant: 'success',
            });
            if (onComplete) {
                await onComplete();
            } else {
                navigate('/dashboard', { replace: true });
            }
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
                title: 'Linking Failed',
                description: desc,
                variant: 'error',
            });
        } finally {
            setIsLinkingGoogle(false);
        }
    };

    const handleSkipSSO = async () => {
        if (activeUserId) {
            authService.setSkippedSSOOnboarding(activeUserId, dontShowAgain);
        }

        if (onComplete) {
            await onComplete();
        } else {
            navigate('/dashboard', { replace: true });
        }
    };

    // RENDER 1: PASSWORD ONBOARDING (MANDATORY)
    if (isPendingPassword) {
        return (
            <AuthLayout
                title="Set Account Password"
                description="Your account was provisioned with a temporary password. Please set your personal password to continue."
                onBack={handleBackToLogin}
                backButtonLabel="Back"
            >
                <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                    <PasswordField
                        label="Temporary / Initial Password"
                        placeholder="Enter your current password"
                        value={currentPassword}
                        onChange={(e) => {
                            setCurrentPassword(e.target.value);
                            if (passwordErrors.current) setPasswordErrors((prev) => ({ ...prev, current: '' }));
                        }}
                        error={passwordErrors.current}
                        leadingIcon={Key}
                        required
                        autoFocus
                    />

                    <PasswordField
                        label="New Password"
                        placeholder="Enter your new password"
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (passwordErrors.new) setPasswordErrors((prev) => ({ ...prev, new: '' }));
                        }}
                        error={passwordErrors.new}
                        leadingIcon={Key}
                        required
                    />

                    <PasswordField
                        label="Confirm New Password"
                        placeholder="Enter your confirm new password"
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (passwordErrors.confirm) setPasswordErrors((prev) => ({ ...prev, confirm: '' }));
                        }}
                        error={passwordErrors.confirm}
                        leadingIcon={Key}
                        required
                    />

                    <Button
                        type="submit"
                        variant="primary"
                        label={isSubmittingPassword ? 'Updating Password...' : 'Save Password & Proceed'}
                        leadingIcon={ArrowRight}
                        isLoading={isSubmittingPassword}
                        className="w-full mt-2"
                    />
                </form>
            </AuthLayout>
        );
    }

    // RENDER 2: OFFICER SIGNATURE ONBOARDING (MANDATORY FOR OFFICERS)
    if (isPendingSignature) {
        return (
            <AuthLayout
                title="Official Officer Signature"
                description="As an Officer, your digital signature is required to stamp approved institutional PDF documents. Upload a clear image of your signature to continue."
                onBack={handleBackToLogin}
                backButtonLabel="Back"
            >
                <form onSubmit={handleSignatureSubmit} className="flex flex-col gap-4">
                    <input
                        ref={signatureInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleStageSignatureFile(e.target.files?.[0])}
                        className="hidden"
                    />

                    {/* INFO BANNER */}
                    <div className="p-3.5 rounded-xl bg-surface-hover/50 border border-surface-border flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-surface border border-surface-border text-accent shrink-0 mt-0.5">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="text-xs font-semibold text-text">
                                Automatic Transparent Stamp Conversion
                            </span>
                            <span className="text-[11px] text-text-muted leading-relaxed">
                                Any background is automatically stripped and cropped into a clean transparent PNG so your signature stamps seamlessly onto official PDFs.
                            </span>
                        </div>
                    </div>

                    {/* SIGNATURE PHOTO DUMP DROPZONE / PREVIEW */}
                    {!signaturePreviewUrl ? (
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => !isProcessingSignature && signatureInputRef.current?.click()}
                            onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && !isProcessingSignature) {
                                    e.preventDefault();
                                    signatureInputRef.current?.click();
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingSignature(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingSignature(false);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingSignature(false);
                                const droppedFile = e.dataTransfer?.files?.[0];
                                if (droppedFile) {
                                    handleStageSignatureFile(droppedFile);
                                }
                            }}
                            className={`group relative flex flex-col items-center justify-center gap-3 p-7 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none text-center ${
                                isDraggingSignature
                                    ? 'border-accent bg-accent/10 scale-[0.99]'
                                    : signatureError
                                        ? 'border-error/60 bg-error/5 hover:border-error'
                                        : 'border-surface-border bg-surface-hover/30 hover:border-accent/60 hover:bg-surface-hover/60'
                            }`}
                        >
                            <div className="p-3.5 rounded-2xl bg-surface border border-surface-border text-accent shadow-xs group-hover:scale-105 transition-transform">
                                {isProcessingSignature ? (
                                    <RefreshCw className="h-6 w-6 animate-spin" />
                                ) : (
                                    <UploadCloud className="h-6 w-6" />
                                )}
                            </div>

                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-text">
                                    {isProcessingSignature
                                        ? 'Removing background & cropping signature...'
                                        : 'Drop your signature image here, or click to browse'}
                                </span>
                                <span className="text-xs text-text-muted">
                                    Supports PNG, JPG, or WEBP (Max 10 MB) · Sign on white paper or upload a digital signature
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-surface border border-surface-border shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                                    <span className="text-xs font-semibold text-text truncate">
                                        {signatureFile?.name || 'signature.png'}
                                    </span>
                                    <span className="text-[11px] text-text-muted shrink-0">
                                        ({formatFileSize(signatureFile?.size)})
                                    </span>
                                </div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20 shrink-0">
                                    <PenTool className="h-3 w-3" />
                                    Transparent PNG
                                </span>
                            </div>

                            {/* TRANSPARENT CHECKERBOARD + SIGNATURE LINE PREVIEW */}
                            <div
                                className="relative flex flex-col items-center justify-center h-36 px-6 py-4 rounded-xl border border-surface-border overflow-hidden"
                                style={{
                                    backgroundColor: '#ffffff',
                                    backgroundImage:
                                        'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                                    backgroundSize: '16px 16px',
                                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
                                }}
                            >
                                <img
                                    src={signaturePreviewUrl}
                                    alt="Processed Officer Signature Preview"
                                    className="max-h-24 max-w-full object-contain z-10 select-none pointer-events-none"
                                />
                                <div className="w-4/5 border-b border-slate-400/70 mt-2 z-0" />
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-1 font-semibold">
                                    Authorized Officer Signature Preview
                                </span>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="small"
                                    label="Replace Image"
                                    leadingIcon={RefreshCw}
                                    onClick={() => signatureInputRef.current?.click()}
                                    disabled={isSubmittingSignature || isProcessingSignature}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="small"
                                    label="Remove"
                                    leadingIcon={Trash2}
                                    onClick={handleClearSignature}
                                    disabled={isSubmittingSignature || isProcessingSignature}
                                />
                            </div>
                        </div>
                    )}

                    {signatureError && (
                        <p className="text-xs font-medium text-error">
                            {signatureError}
                        </p>
                    )}

                    <Button
                        type="submit"
                        variant="primary"
                        label={isSubmittingSignature ? 'Saving Official Signature...' : 'Save Signature & Proceed'}
                        leadingIcon={ArrowRight}
                        isLoading={isSubmittingSignature}
                        disabled={!signatureFile || isProcessingSignature || isSubmittingSignature}
                        className="w-full mt-1"
                    />
                </form>
            </AuthLayout>
        );
    }

    // RENDER 3: SSO ONBOARDING (OPTIONAL)
    return (
        <AuthLayout
            title="Google Single Sign On (SSO)"
            description="Connect your institutional Google account for seamless authentication."
            onBack={handleBackToLogin}
            backButtonLabel="Back"
        >
            <div className="flex flex-col gap-5">
                <div className="p-4 rounded-xl bg-surface-hover/50 border border-surface-border flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-surface border border-surface-border text-accent shrink-0 mt-0.5">
                        <Globe className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-sm font-semibold text-text">
                            Institutional Account
                        </span>
                        <span className="text-xs text-text-muted leading-relaxed">
                            Link <span className="font-semibold text-text">{targetEmail || 'your institutional email'}</span> to enable one-click Google sign-in.
                        </span>
                    </div>
                </div>

                <Button
                    variant="primary"
                    label={isLinkingGoogle ? 'Connecting Account...' : 'Link Google Account'}
                    leadingIcon={ShieldCheck}
                    onClick={handleLinkGoogle}
                    isLoading={isLinkingGoogle}
                    className="w-full justify-center"
                />

                <div className="flex flex-col gap-3 pt-2 border-t border-surface-border">
                    <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer hover:text-text transition-colors select-none">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="rounded border-surface-border text-accent focus:ring-accent accent-accent h-4 w-4"
                        />
                        <span>Don't show SSO on login for this PC</span>
                    </label>

                    <Button
                        variant="secondary"
                        label="Skip for Now"
                        onClick={handleSkipSSO}
                        disabled={isLinkingGoogle}
                        className="w-full justify-center"
                    />
                </div>
            </div>
        </AuthLayout>
    );
};

// --- EXPORTS ---
export { OnboardingPage };
export default OnboardingPage;
