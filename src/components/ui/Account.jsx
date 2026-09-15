// --- IMPORTS ---
import { useState, useRef, useEffect } from 'react';
import {
    Camera,
    Upload,
    Loader2,
    Edit3,
    Save,
    Key,
    Building2,
    User,
    Mail,
    Shield,
    CheckCircle2,
} from 'lucide-react';
import {
    Avatar,
    Badge,
    Modal,
    TextField,
} from '../../components';
import { useUserStore } from '../../stores';
import { storageService } from '../../services';
import { useToast } from '../../hooks';
import { constants } from '../../constants';

// --- COMPONENTS ---
const Account = ({
    isOpen = false,
    onClose,
    currentUser = null,
    className,
    ...props
}) => {
    // REFS
    const avatarInputReference = useRef(null);

    // STATES
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileFirstName, setProfileFirstName] = useState('');
    const [profileMiddleName, setProfileMiddleName] = useState('');
    const [profileLastName, setProfileLastName] = useState('');
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    // HOOKS
    const { showToast } = useToast();

    useEffect(() => {
        if (currentUser) {
            setProfileFirstName(currentUser.first_name ?? currentUser.firstName ?? '');
            setProfileMiddleName(currentUser.middle_name ?? currentUser.middleName ?? '');
            setProfileLastName(currentUser.last_name ?? currentUser.lastName ?? '');
        }
    }, [currentUser]);

    // HANDLERS
    const handleCloseModal = () => {
        setIsEditingProfile(false);
        onClose?.();
    };

    const handleTriggerAvatarUpload = () => {
        avatarInputReference.current?.click();
    };

    const handleAvatarFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const activeId = currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001';
        setIsUploadingAvatar(true);

        try {
            const uploadResult = await storageService.uploadAvatar(activeId, file);
            const storagePointer = uploadResult.path;

            await useUserStore.getState().updateUser(activeId, {
                avatarPath: storagePointer,
            });

            showToast({
                type: 'success',
                title: 'Avatar Updated',
                description: 'Profile avatar has been uploaded and stored in Firebase Storage.',
            });
        } catch (error) {
            console.error('Avatar upload error:', error);
            showToast({
                type: 'error',
                title: 'Avatar Upload Failed',
                description: error?.message ?? 'Could not upload avatar.',
            });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!profileFirstName.trim() || !profileLastName.trim()) {
            showToast({
                type: 'error',
                title: 'Validation Error',
                description: 'First name and last name are required.',
            });
            return;
        }

        try {
            const activeId = currentUser?.id ?? 'f1000001-0000-4000-8000-000000000001';
            await useUserStore.getState().updateUser(activeId, {
                firstName: profileFirstName.trim(),
                middleName: profileMiddleName.trim() || null,
                lastName: profileLastName.trim(),
            });

            setIsEditingProfile(false);
            showToast({
                type: 'success',
                title: 'Profile Updated',
                description: 'Your legal name has been successfully updated.',
            });
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Update Failed',
                description: error?.message ?? 'Could not update profile.',
            });
        }
    };

    const handleStartEdit = () => {
        setIsEditingProfile(true);
    };

    const handleCancelEdit = () => {
        if (currentUser) {
            setProfileFirstName(currentUser.first_name ?? currentUser.firstName ?? '');
            setProfileMiddleName(currentUser.middle_name ?? currentUser.middleName ?? '');
            setProfileLastName(currentUser.last_name ?? currentUser.lastName ?? '');
        }
        setIsEditingProfile(false);
    };

    // DERIVED VALUES
    const userName = currentUser?.name ?? `${currentUser?.first_name ?? currentUser?.firstName ?? 'Carl'} ${currentUser?.last_name ?? currentUser?.lastName ?? 'Avecilla'}`.trim();
    const userFirstName = currentUser?.first_name ?? currentUser?.firstName ?? 'Carl';
    const userMiddleName = currentUser?.middle_name ?? currentUser?.middleName ?? null;
    const userLastName = currentUser?.last_name ?? currentUser?.lastName ?? 'Avecilla';
    const userUniversityId = currentUser?.university_id ?? currentUser?.universityId ?? '20-00001';
    const userEmail = currentUser?.email ?? 'admin.rmo@plpasig.edu.ph';
    const userDepartment = currentUser?.department ?? 'Records Management Office (RMO)';
    const userRole = (currentUser?.role ?? constants?.USERS_ROLE?.ADMINISTRATOR ?? 'ADMINISTRATOR').toLowerCase();
    const userStatus = currentUser?.status ?? constants?.USERS_STATUS?.VERIFIED ?? 'VERIFIED';
    const userAvatar = currentUser?.avatar_path ?? currentUser?.avatarPath ?? null;

    const modalPrimaryAction = isEditingProfile
        ? {
              label: 'Save Profile Changes',
              leadingIcon: Save,
              onClick: handleSaveProfile,
          }
        : {
              label: 'Edit Profile',
              leadingIcon: Edit3,
              onClick: handleStartEdit,
          };

    const modalSecondaryAction = {
        label: isEditingProfile ? 'Cancel' : 'Close',
        onClick: isEditingProfile ? handleCancelEdit : handleCloseModal,
    };

    // RENDER
    return (
        <Modal
            isOpen={isOpen}
            onClose={handleCloseModal}
            title={isEditingProfile ? 'Edit Account Profile' : 'Account Profile'}
            description={isEditingProfile ? 'Update legal identity information' : 'Official university credentials and profile identity'}
            size="lg"
            primaryAction={modalPrimaryAction}
            secondaryAction={modalSecondaryAction}
            className={className}
            {...props}
        >
            {/* HIDDEN AVATAR FILE INPUT */}
            <input
                type="file"
                ref={avatarInputReference}
                onChange={handleAvatarFileChange}
                accept="image/*"
                className="hidden"
            />

            {/* HERO PROFILE CARD */}
            <div className="p-5 rounded-xl bg-surface-hover/50 border border-surface-border flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="relative group shrink-0">
                    <Avatar
                        src={userAvatar}
                        alt={userName}
                        size="extraLarge"
                        className="h-16 w-16 shadow-sm border-2 border-accent"
                    />
                    <button
                        type="button"
                        onClick={handleTriggerAvatarUpload}
                        disabled={isUploadingAvatar}
                        className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-text-inverted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-50"
                        title="Upload New Avatar"
                    >
                        {isUploadingAvatar ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <Camera className="h-5 w-5" />
                                <span className="text-[9px] font-bold mt-1">Upload</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="flex flex-col items-center sm:items-start gap-1 flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h3 className="text-base font-bold font-serif text-text">
                            {userName}
                        </h3>
                        <Badge
                            variant="neutral"
                            label={userRole}
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-text-muted">
                        <span className="font-semibold text-text">
                            {userUniversityId}
                        </span>
                        <span>·</span>
                        <span>{userEmail}</span>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                        <Badge
                            variant={userStatus === 'VERIFIED' ? 'success' : userStatus === 'SUSPENDED' ? 'warning' : 'information'}
                            label={userStatus === 'VERIFIED' ? 'Verified Account' : userStatus === 'SUSPENDED' ? 'Account Suspended' : userStatus}
                        />
                        <button
                            type="button"
                            onClick={handleTriggerAvatarUpload}
                            className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                            <Upload className="h-4 w-4" /> Change Photo
                        </button>
                    </div>
                </div>
            </div>

            {/* BODY: EDIT FORM OR DETAILS GRID */}
            {isEditingProfile ? (
                <div className="flex flex-col gap-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <TextField
                            label="First Name"
                            value={profileFirstName}
                            onChange={(event) => setProfileFirstName(event.target.value)}
                            placeholder="Given name"
                            required
                        />
                        <TextField
                            label="Middle Name (Optional)"
                            value={profileMiddleName}
                            onChange={(event) => setProfileMiddleName(event.target.value)}
                            placeholder="Middle name"
                        />
                    </div>
                    <TextField
                        label="Last Name"
                        value={profileLastName}
                        onChange={(event) => setProfileLastName(event.target.value)}
                        placeholder="Family name"
                        required
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                        <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                            <Key className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 gap-1">
                            <span className="text-text-muted font-medium">University ID</span>
                            <span className="font-semibold text-text truncate">{userUniversityId}</span>
                            <span className="text-text-muted">Official Identifier</span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                        <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                            <Building2 className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 gap-1">
                            <span className="text-text-muted font-medium">Assigned Department</span>
                            <span className="font-semibold text-text truncate">{userDepartment}</span>
                            <span className="text-text-muted">Academic Unit</span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                        <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                            <User className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 gap-1">
                            <span className="text-text-muted font-medium">Full Legal Name</span>
                            <span className="font-semibold text-text truncate">
                                {userFirstName} {userMiddleName ? `${userMiddleName} ` : ''}{userLastName}
                            </span>
                            <span className="text-text-muted">Primary Record Name</span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                        <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                            <Mail className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 gap-1">
                            <span className="text-text-muted font-medium">University Email</span>
                            <span className="font-semibold text-text truncate">{userEmail}</span>
                            <span className="text-text-muted">Official Mailbox</span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                        <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                            <Shield className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 gap-1">
                            <span className="text-text-muted font-medium">Authentication Method</span>
                            <span className="font-semibold text-text truncate">University SSO / Password</span>
                            <span className="text-text-muted">Security Standard</span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg bg-surface border border-surface-border flex items-start gap-3">
                        <div className="p-2 rounded-md bg-accent-background text-accent shrink-0 mt-1">
                            <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 gap-1">
                            <span className="text-text-muted font-medium">Access Status</span>
                            <span className="font-semibold text-accent truncate">{userStatus}</span>
                            <span className="text-text-muted">Institutional Clearance</span>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

// --- EXPORTS ---
export { Account };
