// --- IMPORTS ---
import { useState, useEffect, useRef } from 'react';
import {
    Key,
    Building2,
    User,
    Mail,
    Shield,
    CheckCircle2,
    PenTool,
    UploadCloud,
    RefreshCw,
    Save,
    X,
} from 'lucide-react';
import { Avatar, resolveUserAvatar } from '../Avatar';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { useAuth, useToast } from '../../hooks';
import { storageService, userService } from '../../services';
import { useUserStore } from '../../stores';
import { constants } from '../../constants';

// --- CONFIGURATIONS ---
const STATUS_BADGE_VARIANT = {
    [constants.USERS_STATUS.VERIFIED]: 'success',
    [constants.USERS_STATUS.PENDING_PASSWORD]: 'warning',
    [constants.USERS_STATUS.PENDING_SIGNATURE]: 'warning',
    [constants.USERS_STATUS.PENDING_SSO]: 'information',
    [constants.USERS_STATUS.SUSPENDED]: 'error',
};

// --- COMPONENTS ---
const Account = ({
    isOpen = false,
    onClose,
    currentUser = null,
    user = null,
    className,
    ...props
}) => {
    // HOOKS
    const { currentUser: authUser } = useAuth();
    const { showToast } = useToast();
    const activeTargetUser = user ?? currentUser ?? authUser;
    const isSelf = Boolean(activeTargetUser?.id && authUser?.id && activeTargetUser.id === authUser.id);

    // REACTIVE LISTENER FOR AVATAR & SIGNATURE CHANGES
    const [avatarVersion, setAvatarVersion] = useState(0);
    const [signatureVersion, setSignatureVersion] = useState(0);

    useEffect(() => {
        const avatarHandler = () => setAvatarVersion((v) => v + 1);
        const signatureHandler = () => setSignatureVersion((v) => v + 1);
        window.addEventListener('pamantasan-avatar-changed', avatarHandler);
        window.addEventListener('pamantasan-signature-changed', signatureHandler);
        return () => {
            window.removeEventListener('pamantasan-avatar-changed', avatarHandler);
            window.removeEventListener('pamantasan-signature-changed', signatureHandler);
        };
    }, []);

    // DERIVED VALUES
    const userName = `${activeTargetUser?.firstName ?? ''} ${activeTargetUser?.lastName ?? ''}`.trim() || activeTargetUser?.name || activeTargetUser?.email || 'User';
    const userFirstName = activeTargetUser?.firstName ?? '';
    const userMiddleName = activeTargetUser?.middleName ?? null;
    const userLastName = activeTargetUser?.lastName ?? '';
    const userUniversityId = activeTargetUser?.universityId ?? '—';
    const userEmail = activeTargetUser?.email ?? '—';
    const userDepartment = activeTargetUser?.department ?? 'Central Administration';
    const userDepartmentCode = activeTargetUser?.departmentCode ?? null;
    const userRole = activeTargetUser?.role ?? constants.USERS_ROLE.MEMBER;
    const userStatus = activeTargetUser?.status ?? constants.USERS_STATUS.VERIFIED;
    const userAvatar = resolveUserAvatar(activeTargetUser, authUser);
    const isOfficer = constants.isOfficerRole(userRole);
    const savedSignaturePath = activeTargetUser?.signaturePath ?? (isSelf ? authUser?.signaturePath : null) ?? null;

    // OFFICER SIGNATURE STATES
    const signatureInputRef = useRef(null);
    const [resolvedSignatureUrl, setResolvedSignatureUrl] = useState(null);
    const [isLoadingSignatureUrl, setIsLoadingSignatureUrl] = useState(false);
    const [stagedSignatureFile, setStagedSignatureFile] = useState(null);
    const [stagedSignaturePreviewUrl, setStagedSignaturePreviewUrl] = useState(null);
    const [isProcessingSignature, setIsProcessingSignature] = useState(false);
    const [isDraggingSignature, setIsDraggingSignature] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);
    const [signatureError, setSignatureError] = useState('');

    // RESOLVE EXISTING OFFICER SIGNATURE URL
    useEffect(() => {
        let isMounted = true;

        if (!isOpen || !isOfficer || !savedSignaturePath) {
            setResolvedSignatureUrl(null);
            setIsLoadingSignatureUrl(false);
            return () => {
                isMounted = false;
            };
        }

        if (/^(https?:|data:|blob:)/i.test(savedSignaturePath)) {
            setResolvedSignatureUrl(savedSignaturePath);
            setIsLoadingSignatureUrl(false);
            return () => {
                isMounted = false;
            };
        }

        setIsLoadingSignatureUrl(true);
        storageService.fetchDocument(savedSignaturePath)
            .then((url) => {
                if (isMounted) {
                    setResolvedSignatureUrl(url || null);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setResolvedSignatureUrl(null);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoadingSignatureUrl(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, isOfficer, savedSignaturePath, signatureVersion]);

    // RESET STAGED SIGNATURE ON MODAL CLOSE
    useEffect(() => {
        if (!isOpen) {
            setStagedSignatureFile(null);
            setSignatureError('');
            setStagedSignaturePreviewUrl((prev) => {
                if (prev && prev.startsWith('blob:')) {
                    URL.revokeObjectURL(prev);
                }
                return null;
            });
        }
    }, [isOpen]);

    // CLEANUP STAGED BLOB URL ON UNMOUNT
    useEffect(() => {
        return () => {
            if (stagedSignaturePreviewUrl && stagedSignaturePreviewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(stagedSignaturePreviewUrl);
            }
        };
    }, [stagedSignaturePreviewUrl]);

    // HANDLERS: STAGE & SAVE OFFICER SIGNATURE
    const handleStageSignatureFile = async (rawFile) => {
        if (!rawFile || !isSelf || !isOfficer) return;

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

            setStagedSignaturePreviewUrl((prev) => {
                if (prev && prev.startsWith('blob:')) {
                    URL.revokeObjectURL(prev);
                }
                return nextPreviewUrl;
            });
            setStagedSignatureFile(processedPngFile);
        } catch (error) {
            console.error('Failed to process officer signature image:', error);
            setSignatureError(error?.message || 'Could not process signature image.');
        } finally {
            setIsProcessingSignature(false);
            if (signatureInputRef.current) {
                signatureInputRef.current.value = '';
            }
        }
    };

    const handleCancelStagedSignature = () => {
        setStagedSignatureFile(null);
        setSignatureError('');
        setStagedSignaturePreviewUrl((prev) => {
            if (prev && prev.startsWith('blob:')) {
                URL.revokeObjectURL(prev);
            }
            return null;
        });
        if (signatureInputRef.current) {
            signatureInputRef.current.value = '';
        }
    };

    const handleSaveSignature = async () => {
        if (!stagedSignatureFile || !activeTargetUser?.id || !isSelf || !isOfficer) return;

        setSignatureError('');
        setIsSavingSignature(true);

        try {
            const uploadResult = await storageService.uploadSignature(activeTargetUser.id, stagedSignatureFile);
            const updatePayload = {
                signaturePath: uploadResult.path,
            };

            if (userStatus === constants.USERS_STATUS.PENDING_SIGNATURE) {
                const credentials = await userService.fetchUserCredentialsByUserId(activeTargetUser.id).catch(() => null);
                updatePayload.status = credentials?.googleId
                    ? constants.USERS_STATUS.VERIFIED
                    : constants.USERS_STATUS.PENDING_SSO;
            }

            await useUserStore.getState().updateUser(activeTargetUser.id, updatePayload);
            setResolvedSignatureUrl(uploadResult.url || stagedSignaturePreviewUrl);
            handleCancelStagedSignature();
            window.dispatchEvent(new Event('pamantasan-signature-changed'));

            showToast({
                title: 'Official Signature Updated',
                description: 'Your transparent digital signature has been saved.',
                variant: 'success',
            });
        } catch (error) {
            const message = error?.message || 'Failed to update signature.';
            setSignatureError(message);
            showToast({
                title: 'Signature Update Failed',
                description: message,
                variant: 'error',
            });
        } finally {
            setIsSavingSignature(false);
        }
    };

    const activeDisplaySignatureUrl = stagedSignaturePreviewUrl || resolvedSignatureUrl;

    const modalSecondaryAction = {
        label: 'Close',
        onClick: onClose,
    };

    // RENDER
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isSelf ? 'Account Profile' : `${userRole} Profile`}
            description="Official university credentials and profile identity"
            icon={User}
            callout="Verified university credentials, active department assignments, and security profile details."
            calloutVariant="neutral"
            size="lg"
            secondaryAction={modalSecondaryAction}
            className={className}
            {...props}
        >
            {/* HERO PROFILE CARD */}
            <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-surface via-surface to-surface-hover/60 border border-surface-border shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="relative shrink-0">
                    <div className="p-1 rounded-full bg-surface border border-surface-border shadow-sm">
                        <Avatar
                            key={avatarVersion}
                            src={userAvatar}
                            user={activeTargetUser}
                            alt={userName}
                            size="extraLarge"
                            className="h-20 w-20 ring-2 ring-accent/30"
                        />
                    </div>
                    {userStatus === constants.USERS_STATUS.VERIFIED && (
                        <div
                            className="absolute -bottom-1 -right-1 p-1 bg-surface rounded-full shadow-sm"
                            title="Verified Institutional Account"
                        >
                            <CheckCircle2 className="h-5 w-5 text-accent fill-accent/20" />
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center sm:items-start gap-1.5 flex-1 min-w-0 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h3 className="text-lg font-bold font-serif text-text tracking-tight">
                            {userName}
                        </h3>
                        <Badge
                            variant="neutral"
                            label={userRole}
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-text-muted">
                        <span className="font-semibold text-text font-mono">
                            {userUniversityId}
                        </span>
                        <span>·</span>
                        <span className="truncate">{userEmail}</span>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <Badge
                            variant={STATUS_BADGE_VARIANT[userStatus] ?? 'neutral'}
                            label={userStatus}
                        />
                        {userDepartment && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-hover border border-surface-border text-text-muted">
                                <Building2 className="h-3 w-3 text-accent" />
                                <span>{userDepartmentCode ? `${userDepartmentCode} — ` : ''}{userDepartment}</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* DETAILS GRID (READ ONLY) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                {/* UNIVERSITY ID */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <Key className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">University ID</span>
                        <span className="font-mono font-bold text-sm text-text truncate">{userUniversityId}</span>
                    </div>
                </div>

                {/* DEPARTMENT */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Department</span>
                        <span className="font-semibold text-text truncate" title={userDepartment}>{userDepartment}</span>
                    </div>
                </div>

                {/* FULL NAME */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Full Name</span>
                        <span className="font-semibold text-text truncate">
                            {userFirstName} {userMiddleName ? `${userMiddleName} ` : ''}{userLastName}
                        </span>
                    </div>
                </div>

                {/* EMAIL */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Email</span>
                        <span className="font-semibold text-text truncate" title={userEmail}>{userEmail}</span>
                    </div>
                </div>

                {/* ROLE */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <Shield className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Role</span>
                        <div>
                            <Badge variant="neutral" label={userRole} />
                        </div>
                    </div>
                </div>

                {/* STATUS */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-border/80 flex items-start gap-3 hover:border-accent/40 transition-colors">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5 border border-accent/20">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Account Status</span>
                        <div>
                            <Badge
                                variant={STATUS_BADGE_VARIANT[userStatus] ?? 'neutral'}
                                label={userStatus}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* OFFICIAL DIGITAL SIGNATURE (VISIBLE ONLY TO OFFICER ROLE) */}
            {isOfficer && (
                <div className="mt-1 p-4 rounded-2xl bg-surface border border-surface-border/80 flex flex-col gap-3">
                    <input
                        ref={signatureInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleStageSignatureFile(e.target.files?.[0])}
                        className="hidden"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0 border border-accent/20">
                                <PenTool className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-text">
                                        Official Digital Signature
                                    </span>
                                    <Badge
                                        variant={stagedSignatureFile ? 'warning' : activeDisplaySignatureUrl ? 'success' : 'warning'}
                                        label={stagedSignatureFile ? 'UNSAVED PREVIEW' : activeDisplaySignatureUrl ? 'REGISTERED' : 'MISSING'}
                                    />
                                </div>
                                <span className="text-[11px] text-text-muted">
                                    Transparent PNG signature used for stamping approved institutional PDFs.
                                </span>
                            </div>
                        </div>

                        {isSelf && !stagedSignatureFile && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                label={activeDisplaySignatureUrl ? 'Replace Signature' : 'Upload Signature'}
                                leadingIcon={UploadCloud}
                                onClick={() => signatureInputRef.current?.click()}
                                disabled={isProcessingSignature || isSavingSignature}
                            />
                        )}
                    </div>

                    {/* SIGNATURE PHOTO DUMP / PREVIEW AREA */}
                    <div
                        role={isSelf ? 'button' : undefined}
                        tabIndex={isSelf ? 0 : undefined}
                        onClick={() => {
                            if (isSelf && !isProcessingSignature && !isSavingSignature) {
                                signatureInputRef.current?.click();
                            }
                        }}
                        onKeyDown={(e) => {
                            if (isSelf && (e.key === 'Enter' || e.key === ' ') && !isProcessingSignature && !isSavingSignature) {
                                e.preventDefault();
                                signatureInputRef.current?.click();
                            }
                        }}
                        onDragOver={(e) => {
                            if (!isSelf) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingSignature(true);
                        }}
                        onDragLeave={(e) => {
                            if (!isSelf) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingSignature(false);
                        }}
                        onDrop={(e) => {
                            if (!isSelf) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingSignature(false);
                            const droppedFile = e.dataTransfer?.files?.[0];
                            if (droppedFile) {
                                handleStageSignatureFile(droppedFile);
                            }
                        }}
                        className={`relative flex flex-col items-center justify-center min-h-32 px-6 py-4 rounded-xl border-2 border-dashed transition-all overflow-hidden ${
                            isSelf ? 'cursor-pointer' : ''
                        } ${
                            isDraggingSignature
                                ? 'border-accent bg-accent/10'
                                : 'border-surface-border hover:border-accent/50'
                        }`}
                        style={
                            activeDisplaySignatureUrl
                                ? {
                                    backgroundColor: '#ffffff',
                                    backgroundImage:
                                        'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
                                    backgroundSize: '16px 16px',
                                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
                                }
                                : undefined
                        }
                    >
                        {isProcessingSignature || isLoadingSignatureUrl ? (
                            <div className="flex flex-col items-center gap-2 text-text-muted py-3">
                                <RefreshCw className="h-5 w-5 animate-spin text-accent" />
                                <span className="text-xs font-medium">
                                    {isProcessingSignature
                                        ? 'Removing background & cropping signature...'
                                        : 'Loading signature...'}
                                </span>
                            </div>
                        ) : activeDisplaySignatureUrl ? (
                            <>
                                <img
                                    src={activeDisplaySignatureUrl}
                                    alt={`${userName} Official Signature`}
                                    className="max-h-20 max-w-full object-contain z-10 select-none pointer-events-none"
                                />
                                <div className="w-3/4 border-b border-slate-400/70 mt-2 z-0" />
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-1 font-semibold">
                                    {isSelf
                                        ? 'Drop a new image here or click to update signature (Auto-Transparent PNG)'
                                        : 'Authorized Officer Signature'}
                                </span>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-1.5 text-center py-2">
                                <UploadCloud className="h-6 w-6 text-accent" />
                                <span className="text-xs font-semibold text-text">
                                    {isSelf
                                        ? 'Drop signature image here, or click to upload'
                                        : 'No official signature uploaded yet'}
                                </span>
                                {isSelf && (
                                    <span className="text-[11px] text-text-muted">
                                        PNG, JPG, or WEBP · Background is automatically stripped to transparent PNG
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {signatureError && (
                        <p className="text-xs font-medium text-error">
                            {signatureError}
                        </p>
                    )}

                    {isSelf && stagedSignatureFile && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                label="Cancel"
                                leadingIcon={X}
                                onClick={handleCancelStagedSignature}
                                disabled={isSavingSignature}
                            />
                            <Button
                                type="button"
                                variant="primary"
                                size="small"
                                label={isSavingSignature ? 'Saving Signature...' : 'Save Signature'}
                                leadingIcon={Save}
                                isLoading={isSavingSignature}
                                onClick={handleSaveSignature}
                            />
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};

// --- EXPORTS ---
export { Account };
export default Account;
