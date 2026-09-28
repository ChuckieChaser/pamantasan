// --- IMPORTS ---
import { useState, useMemo, useRef, useEffect } from 'react';
import {
    Users,
    Plus,
    Shield,
    Building2,
    Clock,
    Upload,
    UserPlus,
    UserCog,
    UserCheck,
    UserX,
    Trash2,
    ArrowDownAZ,
    ArrowUpAZ,
} from 'lucide-react';
import {
    Avatar,
    Browser,
    Container,
    History,
    Modal,
    SelectField,
    TextField,
    formatUniversityId,
    formatDateTime,
    resolveUserAvatar,
} from '../components';
import { useToast, useAuth } from '../hooks';
import { useUserStore, useDepartmentStore, useAuthStore, useCoordinatorStore } from '../stores';
import { storageService, authService, coordinatorApprovalService } from '../services';
import { constants } from '../constants';


// --- CONFIGURATIONS ---
const USER_COLUMNS = [
    { key: 'title', label: 'Name' },
    { key: 'universityId', label: 'University ID' },
    { key: 'department', label: 'Department' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Created At' },
];

const USER_SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A to Z)', icon: ArrowDownAZ },
    { value: 'name-desc', label: 'Name (Z to A)', icon: ArrowUpAZ },
    { value: 'date-desc', label: 'Recently Added', icon: Clock },
    { value: 'date-asc', label: 'Oldest Added', icon: Clock },
];

const ROLE_OPTIONS = [
    { value: constants.USERS_ROLE.ADMINISTRATOR, label: constants.USERS_ROLE.ADMINISTRATOR },
    { value: constants.USERS_ROLE.COORDINATOR, label: constants.USERS_ROLE.COORDINATOR },
    { value: constants.USERS_ROLE.DIRECTOR, label: constants.USERS_ROLE.DIRECTOR },
    { value: constants.USERS_ROLE.OFFICER, label: constants.USERS_ROLE.OFFICER },
    { value: constants.USERS_ROLE.MEMBER, label: constants.USERS_ROLE.MEMBER },
];

const RMO_DEPARTMENT_RAW = 'd9c76dc863dc4126a46ba17e55bb73d3';

const isNonRmoRole = (role) =>
    role === constants.USERS_ROLE.DIRECTOR ||
    role === constants.USERS_ROLE.OFFICER ||
    role === constants.USERS_ROLE.MEMBER;

const isRmoDepartment = (dept, resolvedRmoId = RMO_DEPARTMENT_RAW) => {
    if (!dept) return false;
    return (
        dept?.id === resolvedRmoId ||
        dept?.id === RMO_DEPARTMENT_RAW ||
        dept?.code?.toUpperCase() === 'RMO' ||
        dept?.name?.toLowerCase().includes('records management')
    );
};

const isRmoDepartmentId = (deptId, departmentsList = [], resolvedRmoId = RMO_DEPARTMENT_RAW) => {
    if (!deptId) return false;
    if (deptId === resolvedRmoId || deptId === RMO_DEPARTMENT_RAW) return true;
    const target = departmentsList?.find((d) => d?.id === deptId);
    return isRmoDepartment(target, resolvedRmoId);
};


// --- COMPONENTS ---
const UsersPage = ({
    currentUser: propUser = null,
    selectedItem = null,
    onSelectUser = null,
    className,
    ...props
}) => {
    // REFS
    const addAvatarInputRef = useRef(null);
    const editAvatarInputRef = useRef(null);

    // STATES
    const [selectedUser, setSelectedUser] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [suspendingUser, setSuspendingUser] = useState(null);
    const [deletingUser, setDeletingUser] = useState(null);

    // ACTION LOADING FEEDBACK
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [isUpdatingUser, setIsUpdatingUser] = useState(false);
    const [isSuspendingLoading, setIsSuspendingLoading] = useState(false);
    const [isDeletingUserLoading, setIsDeletingUserLoading] = useState(false);

    // FORM STATES
    const [formUniversityId, setFormUniversityId] = useState('');
    const [formFirstName, setFormFirstName] = useState('');
    const [formMiddleName, setFormMiddleName] = useState('');
    const [formLastName, setFormLastName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formDepartmentId, setFormDepartmentId] = useState('');
    const [formRole, setFormRole] = useState(constants.USERS_ROLE.MEMBER);
    const [formAvatarPath, setFormAvatarPath] = useState(null);
    const [formAvatarFile, setFormAvatarFile] = useState(null);
    const [formErrors, setFormErrors] = useState({});
    const [editFormErrors, setEditFormErrors] = useState({});

    // HOOKS
    const { showToast } = useToast();

    // STORES
    const users = useUserStore((state) => state.users);
    const fetchUsers = useUserStore((state) => state.fetchUsers);
    const insertUser = useUserStore((state) => state.insertUser);
    const updateUser = useUserStore((state) => state.updateUser);
    const deleteUser = useUserStore((state) => state.deleteUser);
    const departments = useDepartmentStore((state) => state.departments);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);

    const rmoDepartment = useMemo(() => {
        return departments.find((d) => 
            d?.id === RMO_DEPARTMENT_RAW ||
            d?.code?.toUpperCase() === 'RMO' ||
            d?.name?.toLowerCase().includes('records management')
        ) ?? null;
    }, [departments]);

    const resolvedRmoId = rmoDepartment?.id ?? RMO_DEPARTMENT_RAW;
    const isRoleLockedToRMO = formRole === constants.USERS_ROLE.ADMINISTRATOR || formRole === constants.USERS_ROLE.COORDINATOR;

    const handleRoleChange = (newRole) => {
        setFormRole(newRole);
        if (newRole === constants.USERS_ROLE.ADMINISTRATOR || newRole === constants.USERS_ROLE.COORDINATOR) {
            setFormDepartmentId(resolvedRmoId);
        } else if (isNonRmoRole(newRole)) {
            if (isRmoDepartmentId(formDepartmentId, departments, resolvedRmoId)) {
                setFormDepartmentId('');
            }
        }
    };
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const currentUser = propUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isCoordinator = constants.isCoordinatorRole(currentUser?.role);

    // EFFECTS
    const [avatarVersion, setAvatarVersion] = useState(0);
    useEffect(() => {
        const handler = () => setAvatarVersion((v) => v + 1);
        window.addEventListener('pamantasan-avatar-changed', handler);
        return () => window.removeEventListener('pamantasan-avatar-changed', handler);
    }, []);

    useEffect(() => {
        fetchUsers().catch(() => {});
        fetchDepartments().catch(() => {});
    }, [fetchUsers, fetchDepartments]);

    // LISTEN FOR EXTERNAL SUSPEND TRIGGER (E.G. FROM INSPECTOR QUICK ACTION)
    useEffect(() => {
        const handleSuspendUserEvent = (event) => {
            if (event.detail) {
                const targetUser = users.find((u) => u?.id === event.detail.id) ?? event.detail;
                setSuspendingUser(targetUser);
            }
        };
        window.addEventListener('pamantasan:suspend-user', handleSuspendUserEvent);
        return () => window.removeEventListener('pamantasan:suspend-user', handleSuspendUserEvent);
    }, [users]);

    // HANDLERS
    const handleSelectUser = (item, targetTab = null) => {
        const itemWithTab = item ? (targetTab ? { ...item, _targetTab: targetTab } : item) : null;
        setSelectedUser(itemWithTab);
        onSelectUser?.(itemWithTab, targetTab);
    };

    const handleOpenAddModal = () => {
        setFormUniversityId('');
        setFormFirstName('');
        setFormMiddleName('');
        setFormLastName('');
        setFormEmail('');
        setFormDepartmentId('');
        setFormRole(constants.USERS_ROLE.MEMBER);
        setFormAvatarPath(null);
        setFormAvatarFile(null);
        setFormErrors({});
        setIsAddModalOpen(true);
    };

    const handleOpenEditModal = (userItem) => {
        const rawUser = users.find((user) => user.id === userItem.id) ?? userItem;
        const rawRole = rawUser.role ?? constants.USERS_ROLE.MEMBER;
        const isLocked = rawRole === constants.USERS_ROLE.ADMINISTRATOR || rawRole === constants.USERS_ROLE.COORDINATOR;

        setEditingUser(rawUser);
        setFormUniversityId(rawUser.universityId ?? '');
        setFormFirstName(rawUser.firstName ?? '');
        setFormMiddleName(rawUser.middleName ?? '');
        setFormLastName(rawUser.lastName ?? '');
        setFormEmail(rawUser.email ? rawUser.email.replace(/@.*$/, '') : '');
        setFormRole(rawRole);
        setFormDepartmentId(isLocked ? resolvedRmoId : (rawUser.departmentId ?? departments[0]?.id ?? ''));
        setFormAvatarPath(rawUser.avatarPath ?? null);
        setFormAvatarFile(null);
        setEditFormErrors({});
    };

    const handleCloseModals = () => {
        if (isCreatingUser || isUpdatingUser || isSuspendingLoading || isDeletingUserLoading) {
            return;
        }
        setIsAddModalOpen(false);
        setEditingUser(null);
        setSuspendingUser(null);
        setDeletingUser(null);
        setFormAvatarFile(null);
        setFormErrors({});
        setEditFormErrors({});
    };

    const handleItemAction = async (actionKey, item) => {
        const rawUser = users.find((user) => user.id === item.id) ?? item;

        if (actionKey === 'view_profile' || actionKey === 'open') {
            handleSelectUser({ ...rawUser, _targetTab: 'information' }, 'information');
            return;
        }

        if (actionKey === 'view_activity') {
            handleSelectUser({ ...rawUser, _targetTab: 'activity' }, 'activity');
            return;
        }

        if (actionKey === 'edit') {
            handleOpenEditModal(rawUser);
            return;
        }

        if (actionKey === 'suspend' || actionKey === 'unsuspend') {
            const isSelfUser = Boolean(
                currentUser && (
                    rawUser.id === currentUser.id ||
                    (rawUser.universityId && currentUser.universityId === rawUser.universityId)
                )
            );

            if (actionKey === 'suspend' && isSelfUser && String(rawUser.status).toUpperCase() !== constants.USERS_STATUS.SUSPENDED) {
                showToast({
                    type: 'error',
                    title: 'Action Prohibited',
                    description: 'Administrators cannot suspend their own account. Another administrator must perform this action.',
                });
                return;
            }

            setSuspendingUser({ ...rawUser, _isUnsuspending: actionKey === 'unsuspend' });
            return;
        }

        if (actionKey === 'delete') {
            setDeletingUser(rawUser);
            return;
        }
    };

    const handleCreateUser = async () => {
        const errors = {};
        const cleanUid = formUniversityId.trim();
        if (!cleanUid) {
            errors.universityId = 'University ID is required.';
        } else if (!constants.VALIDATION_PATTERNS.UNIVERSITY_ID.test(cleanUid)) {
            errors.universityId = 'Format must be YY-NNNNN.';
        }

        if (!formFirstName.trim()) {
            errors.firstName = 'First name is required.';
        }
        if (!formLastName.trim()) {
            errors.lastName = 'Last name is required.';
        }

        const rawUsername = formEmail.trim().toLowerCase().replace(/@.*$/, '');
        const cleanEmail = rawUsername ? `${rawUsername}${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}` : '';

        if (!cleanEmail) {
            errors.email = 'Email username is required.';
        } else if (!cleanEmail.endsWith(constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN)) {
            errors.email = `Must end with ${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}`;
        } else if (!constants.VALIDATION_PATTERNS.EMAIL.test(cleanEmail)) {
            errors.email = 'Invalid email address.';
        }

        if (!formRole) {
            errors.role = 'Role is required.';
        }

        const finalDepartmentId = (formRole === constants.USERS_ROLE.ADMINISTRATOR || formRole === constants.USERS_ROLE.COORDINATOR)
            ? resolvedRmoId
            : formDepartmentId;

        if (!finalDepartmentId) {
            errors.departmentId = 'Department is required.';
        } else if (isNonRmoRole(formRole) && isRmoDepartmentId(finalDepartmentId, departments, resolvedRmoId)) {
            errors.departmentId = 'Selected role cannot belong to the Records Management Office.';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setIsCreatingUser(true);
        setFormErrors({});

        try {
            let uploadedAvatarPath = formAvatarPath;
            if (formAvatarFile) {
                const uploadResult = await storageService.uploadAvatar(formUniversityId.trim(), formAvatarFile);
                uploadedAvatarPath = uploadResult.path;
            }

            const targetUid = formUniversityId.trim();
            const targetEmail = cleanEmail;
            const tempPassword = targetUid;

            if (isCoordinator) {
                const userPayload = {
                    universityId: targetUid,
                    password: tempPassword,
                    firstName: formFirstName.trim(),
                    middleName: formMiddleName.trim() || null,
                    lastName: formLastName.trim(),
                    email: targetEmail,
                    departmentId: finalDepartmentId,
                    role: formRole,
                    status: constants.USERS_STATUS.PENDING_PASSWORD,
                    avatarPath: uploadedAvatarPath,
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.USER_CREATE,
                    requesterId,
                    data: userPayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                const fullName = `${formFirstName.trim()} ${formLastName.trim()}`.trim();
                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `User registration request for "${fullName}" sent for Administrator approval.`,
                });
                handleCloseModals();
                return;
            }

            const activeActor = currentUser || useAuthStore.getState().currentUser;
            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            const [newUser] = await Promise.all([
                insertUser({
                    universityId: targetUid,
                    password: tempPassword,
                    firstName: formFirstName.trim(),
                    middleName: formMiddleName.trim() || null,
                    lastName: formLastName.trim(),
                    email: targetEmail,
                    departmentId: finalDepartmentId,
                    role: formRole,
                    status: constants.USERS_STATUS.PENDING_PASSWORD,
                    avatarPath: uploadedAvatarPath,
                }, activeActor),
                minTimer,
            ]);

            const targetFirstName = newUser?.firstName || formFirstName.trim();
            const targetLastName = newUser?.lastName || formLastName.trim();
            const fullName = `${targetFirstName} ${targetLastName}`.trim();

            // Dispatch official user provisioning email with credentials
            authService.sendUserProvisionEmail({
                email: targetEmail,
                recipientName: fullName,
                universityId: targetUid,
                temporaryPassword: tempPassword,
                loginUrl: 'https://pamantasan-records-210fe.web.app/login',
            }).catch((emailErr) => {
                console.warn('Background provision email dispatch encountered error:', emailErr);
            });

            showToast({
                type: 'success',
                title: 'User Registered',
                description: `${fullName} registered. Credentials sent to ${targetEmail}.`,
            });

            // Auto-select and focus the newly created user
            const dept = departments.find((d) => d.id === finalDepartmentId);
            const deptCode = dept?.code ?? 'Central';
            const deptDisplay = dept ? `${dept.name} (${dept.code})` : deptCode;
            const formattedNewUser = {
                id: newUser.id,
                title: fullName,
                name: fullName,
                firstName: targetFirstName,
                middleName: formMiddleName.trim() || null,
                lastName: targetLastName,
                universityId: targetUid,
                email: targetEmail,
                role: formRole,
                department: deptDisplay,
                departmentCode: deptCode,
                departmentId: finalDepartmentId,
                status: constants.USERS_STATUS.PENDING_PASSWORD,
                avatarPath: uploadedAvatarPath,
                user: newUser,
                metadata: `${targetUid} · ${deptCode}`,
                description: `${targetEmail} — ${formRole} in ${deptDisplay}`,
                createdAt: newUser?.createdAt || new Date().toISOString(),
                updatedAt: newUser?.updatedAt || newUser?.createdAt || new Date().toISOString(),
                date: formatDateTime(newUser?.createdAt || new Date().toISOString()),
            };
            setSelectedUser(formattedNewUser);
            onSelectUser?.(formattedNewUser);

            handleCloseModals();
        } catch (error) {
            const msg = error?.message ?? 'Failed to register user.';
            if (msg.toLowerCase().includes('university id')) {
                setFormErrors({ universityId: msg });
            } else if (msg.toLowerCase().includes('email')) {
                setFormErrors({ email: msg });
            } else {
                showToast({ type: 'error', title: 'Registration Failed', description: msg });
            }
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleUpdateUser = async () => {
        if (!editingUser) {
            return;
        }

        const errors = {};
        if (!formFirstName.trim()) {
            errors.firstName = 'First name is required.';
        }
        if (!formLastName.trim()) {
            errors.lastName = 'Last name is required.';
        }

        const rawUsername = formEmail.trim().toLowerCase().replace(/@.*$/, '');
        const cleanEmail = rawUsername ? `${rawUsername}${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}` : '';

        if (!cleanEmail) {
            errors.email = 'Email username is required.';
        } else if (!cleanEmail.endsWith(constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN)) {
            errors.email = `Must end with ${constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}`;
        } else if (!constants.VALIDATION_PATTERNS.EMAIL.test(cleanEmail)) {
            errors.email = 'Invalid email address.';
        }

        if (!formRole) {
            errors.role = 'Role is required.';
        }

        const finalDepartmentId = (formRole === constants.USERS_ROLE.ADMINISTRATOR || formRole === constants.USERS_ROLE.COORDINATOR)
            ? resolvedRmoId
            : formDepartmentId;

        if (!finalDepartmentId) {
            errors.departmentId = 'Department is required.';
        }

        if (Object.keys(errors).length > 0) {
            setEditFormErrors(errors);
            return;
        }

        setIsUpdatingUser(true);
        setEditFormErrors({});

        try {
            let uploadedAvatarPath = formAvatarPath;
            if (formAvatarFile) {
                const uploadResult = await storageService.uploadAvatar(editingUser.id, formAvatarFile);
                uploadedAvatarPath = uploadResult.path;
            }

            if (isCoordinator) {
                const userPayload = {
                    userId: editingUser.id,
                    old: {
                        firstName: editingUser.firstName,
                        middleName: editingUser.middleName,
                        lastName: editingUser.lastName,
                        email: editingUser.email,
                        role: editingUser.role,
                        departmentId: editingUser.departmentId,
                    },
                    new: {
                        firstName: formFirstName.trim(),
                        middleName: formMiddleName.trim() || null,
                        lastName: formLastName.trim(),
                        email: cleanEmail,
                        departmentId: finalDepartmentId,
                        role: formRole,
                        avatarPath: uploadedAvatarPath,
                    },
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.USER_UPDATE,
                    requesterId,
                    data: userPayload,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Profile update request for "${editingUser.universityId}" sent for Administrator approval.`,
                });
                handleCloseModals();
                return;
            }

            const activeActor = currentUser || useAuthStore.getState().currentUser;
            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            const [updated] = await Promise.all([
                updateUser(editingUser.id, {
                    firstName: formFirstName.trim(),
                    middleName: formMiddleName.trim() || null,
                    lastName: formLastName.trim(),
                    email: cleanEmail,
                    departmentId: finalDepartmentId,
                    role: formRole,
                    avatarPath: uploadedAvatarPath,
                }, activeActor),
                minTimer,
            ]);

            if (selectedUser?.id === editingUser.id) {
                const refreshed = {
                    ...selectedUser,
                    ...updated,
                    title: `${updated.firstName} ${updated.lastName}`.trim(),
                    name: `${updated.firstName} ${updated.lastName}`.trim(),
                };
                setSelectedUser(refreshed);
                onSelectUser?.(refreshed);
            }

            showToast({
                type: 'success',
                title: 'User Updated',
                description: `Updated profile for ${editingUser.universityId}.`,
            });
            handleCloseModals();
        } catch (error) {
            const errorMessage = error?.message ?? 'Failed to update user.';
            setEditFormErrors({ general: errorMessage });
            showToast({
                type: 'error',
                title: 'Update Failed',
                description: errorMessage,
            });
        } finally {
            setIsUpdatingUser(false);
        }
    };

    const handleToggleSuspendUser = async () => {
        if (!suspendingUser) {
            return;
        }

        const isSelfUser = Boolean(
            currentUser && (
                suspendingUser.id === currentUser.id ||
                (suspendingUser.universityId && currentUser.universityId === suspendingUser.universityId)
            )
        );

        const isCurrentlySuspended = Boolean(
            suspendingUser._isUnsuspending ||
            String(suspendingUser.status || '').toUpperCase() === constants.USERS_STATUS.SUSPENDED
        );

        let newStatus;
        if (isCurrentlySuspended) {
            const restored = useUserStore.getState().getPreviousStatus(suspendingUser.id);
            newStatus = (restored && String(restored).toUpperCase() !== constants.USERS_STATUS.SUSPENDED)
                ? restored
                : constants.USERS_STATUS.VERIFIED;
        } else {
            newStatus = constants.USERS_STATUS.SUSPENDED;
        }

        if (newStatus === constants.USERS_STATUS.SUSPENDED && isSelfUser) {
            showToast({
                type: 'error',
                title: 'Action Prohibited',
                description: 'Administrators cannot suspend their own account. Another administrator must perform this action.',
            });
            return;
        }

        if (isCoordinator) {
            const userPayload = {
                userId: suspendingUser.id,
                universityId: suspendingUser.universityId,
                name: `${suspendingUser.firstName} ${suspendingUser.lastName}`.trim(),
                old: {
                    status: suspendingUser.status,
                },
                new: {
                    status: newStatus,
                },
            };

            const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
            await coordinatorApprovalService.submitCoordinatorRequest({
                action: constants.COORDINATOR_REQUESTS_ACTION.USER_UPDATE,
                requesterId,
                data: userPayload,
            });
            useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

            showToast({
                type: 'success',
                title: 'Request Submitted',
                description: `User status change request for "${suspendingUser.universityId}" sent for Administrator approval.`,
            });
            setSuspendingUser(null);
            return;
        }

        setIsSuspendingLoading(true);

        try {
            const activeActor = currentUser || useAuthStore.getState().currentUser;
            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            const [updated] = await Promise.all([
                updateUser(suspendingUser.id, { status: newStatus }, activeActor),
                minTimer,
            ]);

            if (selectedUser?.id === suspendingUser.id) {
                const refreshed = {
                    ...selectedUser,
                    ...updated,
                    status: newStatus,
                };
                setSelectedUser(refreshed);
                onSelectUser?.(refreshed);
            }

            showToast({
                type: newStatus === constants.USERS_STATUS.SUSPENDED ? 'warning' : 'success',
                title: newStatus === constants.USERS_STATUS.SUSPENDED ? 'Account Suspended' : 'Account Re-activated',
                description: `${suspendingUser.firstName} ${suspendingUser.lastName} (${suspendingUser.universityId}) is now ${newStatus}.`,
            });
            handleCloseModals();
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Status Update Failed',
                description: error?.message ?? 'Could not update user status.',
            });
        } finally {
            setIsSuspendingLoading(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!deletingUser) {
            return;
        }

        if (isCoordinator) {
            const userPayload = {
                userId: deletingUser.id,
                universityId: deletingUser.universityId,
                name: `${deletingUser.firstName} ${deletingUser.lastName}`.trim(),
                old: {
                    universityId: deletingUser.universityId,
                    name: `${deletingUser.firstName} ${deletingUser.lastName}`.trim(),
                    email: deletingUser.email,
                    role: deletingUser.role,
                    department: deletingUser.department,
                    status: deletingUser.status,
                },
                new: {
                    status: 'DELETED',
                },
            };

            const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
            await coordinatorApprovalService.submitCoordinatorRequest({
                action: constants.COORDINATOR_REQUESTS_ACTION.USER_DELETE,
                requesterId,
                data: userPayload,
            });
            useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});

            showToast({
                type: 'success',
                title: 'Request Submitted',
                description: `User deletion request for "${deletingUser.universityId}" sent for Administrator approval.`,
            });
            handleCloseModals();
            return;
        }

        setIsDeletingUserLoading(true);
        try {
            const activeActor = currentUser || useAuthStore.getState().currentUser;
            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            await Promise.all([
                deleteUser(deletingUser.id, activeActor),
                minTimer,
            ]);

            if (selectedUser?.id === deletingUser.id) {
                setSelectedUser(null);
                onSelectUser?.(null);
            }

            showToast({
                type: 'success',
                title: 'User Deleted',
                description: `User ${deletingUser.universityId} has been deleted.`,
            });
            handleCloseModals();
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Deletion Failed',
                description: error?.message ?? 'Could not delete user.',
            });
        } finally {
            setIsDeletingUserLoading(false);
        }
    };

    // DERIVED VALUES
    const departmentFormOptions = useMemo(() => {
        return departments.map((department) => ({
            value: department.id,
            label: `${department.name} (${department.code})`,
        }));
    }, [departments]);

    const creationDepartmentOptions = useMemo(() => {
        const availableDepartments = isNonRmoRole(formRole)
            ? departments.filter((d) => !isRmoDepartment(d, resolvedRmoId))
            : departments;

        return availableDepartments.map((department) => ({
            value: department.id,
            label: `${department.name} (${department.code})`,
        }));
    }, [departments, formRole, resolvedRmoId]);

    const userFilterOptions = useMemo(() => {
        const roleFilters = ROLE_OPTIONS.map((option) => ({
            category: 'Role',
            value: option.value,
            label: option.label,
            icon: Shield,
        }));

        const departmentFilters = departments.map((department) => ({
            category: 'Department',
            value: department.code,
            label: department.name,
            icon: Building2,
        }));

        return [...roleFilters, ...departmentFilters];
    }, [departments]);

    const formattedUserData = useMemo(() => {
        void avatarVersion;
        return (users || []).filter(Boolean).map((user) => {
            const department = departments?.find(
                (dept) => dept?.id === user.departmentId ||
                          dept?.name === user.department ||
                          dept?.code === user.department
            ) ?? null;
            const departmentCode = department?.code ?? user.departmentCode ?? 'Central';
            const departmentDisplay = department
                ? `${department.name} (${department.code})`
                : (user.department || departmentCode);

            const userFirstName = user.firstName ?? '';
            const userLastName = user.lastName ?? '';
            const fullName = `${userFirstName} ${userLastName}`.trim() || user.email || 'User';
            const universityId = user.universityId ?? '';
            const createdAt = user.createdAt;
            const resolvedAvatar = resolveUserAvatar(user, currentUser);

            return {
                id: user.id,
                title: fullName,
                name: fullName,
                firstName: userFirstName,
                middleName: user.middleName ?? null,
                lastName: userLastName,
                universityId: universityId,
                email: user.email,
                role: user.role,
                department: departmentDisplay,
                departmentCode: departmentCode,
                departmentId: user.departmentId,
                status: user.status,
                avatarPath: resolvedAvatar,
                user: user,
                metadata: `${universityId} · ${departmentCode}`,
                description: `${user.email} — ${user.role} in ${departmentDisplay}`,
                createdAt: createdAt ?? null,
                updatedAt: user.updatedAt ?? createdAt ?? null,
                date: createdAt && !isNaN(new Date(createdAt).getTime())
                    ? formatDateTime(createdAt)
                    : 'Active Member',
            };
        });
    }, [users, departments, currentUser, avatarVersion]);

    const activeUserData = useMemo(() => {
        return formattedUserData.filter((user) => user.status !== constants.USERS_STATUS.SUSPENDED);
    }, [formattedUserData]);

    const suspendedUserData = useMemo(() => {
        return formattedUserData.filter((user) => user.status === constants.USERS_STATUS.SUSPENDED);
    }, [formattedUserData]);

    const activeSelectedUser = useMemo(() => {
        const targetId = selectedItem?.id ?? selectedUser?.id;
        if (!targetId) return null;
        const matched = formattedUserData.find((u) => u.id === targetId);
        return matched ?? null;
    }, [selectedItem, selectedUser, formattedUserData]);

    // Safety cleanup: Ensure deleted user is cleared from store selection
    useEffect(() => {
        if (
            selectedUser?.id &&
            users.length > 0 &&
            !users.some((u) => u?.id === selectedUser.id)
        ) {
            setSelectedUser(null);
            onSelectUser?.(null);
        }
    }, [users, selectedUser?.id, setSelectedUser, onSelectUser]);

    // RENDER
    return (
        <Container variant="page" className={`flex flex-col gap-6 ${className ?? ''}`} {...props}>
            <Browser
                resourceName="users"
                title="Manage Users"
                description="Manage institutional users."
                data={activeUserData}
                columns={USER_COLUMNS}
                sortOptions={USER_SORT_OPTIONS}
                filterOptions={userFilterOptions}
                selectedItem={activeSelectedUser}
                addItemLabel="New User"
                addItemIcon={Plus}
                searchPlaceholder="Search user..."
                onAddItem={handleOpenAddModal}
                onSelectItem={handleSelectUser}
                onOpenItem={handleSelectUser}
                onItemAction={handleItemAction}
            />

            <hr className="border-t border-surface-border my-2" />

            {/* COMPLIANCE & HISTORICAL SUSPENDED ACCOUNTS */}
            <History
                title="Suspended Users"
                description="Preserved for compliance and auditing."
                resourceName="users"
                data={suspendedUserData}
                selectedId={activeSelectedUser?.id}
                onItemClick={(item) => handleSelectUser(item)}
                onItemAction={handleItemAction}
                emptyMessage="No suspended user accounts on record."
                searchPlaceholder="Search suspended users..."
            />

            {/* REGISTER USER MODAL (SIZE LG, EXACT ORDER: AVATAR -> UNIVERSITY ID -> NAMES -> EMAIL -> DEPARTMENT -> ROLES) */}
            {isAddModalOpen && (
                <Modal
                    isOpen={isAddModalOpen}
                    onClose={handleCloseModals}
                    size="lg"
                    title="New User"
                    icon={UserPlus}
                    callout="Create an institutional user to provision university credentials, assign academic roles, and configure departmental access permissions."
                    calloutVariant="neutral"
                    onConfirm={handleCreateUser}
                    confirmLabel={isCreatingUser ? 'Registering User...' : 'Register User'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isCreatingUser}
                    isConfirmDisabled={isCreatingUser}
                >
                    <div className="flex flex-col gap-4 py-2">
                        {/* 1. AVATAR UPLOAD */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-surface-hover/40 border border-surface-border">
                            <Avatar
                                src={formAvatarFile ? URL.createObjectURL(formAvatarFile) : formAvatarPath}
                                alt="New User Avatar"
                                size="large"
                                className="h-20 w-20 rounded-full aspect-square shadow-md ring-2 ring-surface-border shrink-0 text-xl"
                            />
                            <div className="flex flex-col justify-center items-center sm:items-start gap-2 flex-1 text-center sm:text-left">
                                <div>
                                    <h4 className="text-sm font-bold text-text">
                                        Profile Photo
                                    </h4>
                                    <p className="text-xs text-text-muted mt-0.5">
                                        Upload official identification picture (JPEG, PNG, or WebP).
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        ref={addAvatarInputRef}
                                        onChange={(changeEvent) => setFormAvatarFile(changeEvent.target.files?.[0] ?? null)}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => addAvatarInputRef.current?.click()}
                                        className="px-3 py-1.5 rounded-md border border-surface-border bg-surface hover:bg-surface-hover text-xs font-medium text-text inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                                    >
                                        <Upload className="h-3.5 w-3.5" />
                                        {formAvatarFile ? 'Change Photo' : 'Upload Photo'}
                                    </button>
                                    {formAvatarFile && (
                                        <button
                                            type="button"
                                            onClick={() => setFormAvatarFile(null)}
                                            className="px-2 py-1.5 rounded-md text-xs text-error hover:bg-error-background transition-colors cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. UNIVERSITY ID */}
                        <TextField
                            label="University ID"
                            placeholder="Enter University ID"
                            value={formUniversityId}
                            onChange={(changeEvent) => {
                                setFormUniversityId(formatUniversityId(changeEvent.target.value));
                                if (formErrors.universityId) setFormErrors((prev) => ({ ...prev, universityId: undefined }));
                            }}
                            maxLength={8}
                            required
                            error={formErrors.universityId}
                        />

                        {/* 3. NAMES */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <TextField
                                label="First Name"
                                placeholder="Enter First Name"
                                value={formFirstName}
                                onChange={(changeEvent) => {
                                    setFormFirstName(changeEvent.target.value);
                                    if (formErrors.firstName) setFormErrors((prev) => ({ ...prev, firstName: undefined }));
                                }}
                                required
                                error={formErrors.firstName}
                            />
                            <TextField
                                label="Middle Name"
                                placeholder="Enter Middle Name"
                                value={formMiddleName}
                                onChange={(changeEvent) => setFormMiddleName(changeEvent.target.value)}
                            />
                            <TextField
                                label="Last Name"
                                placeholder="Enter Last Name"
                                value={formLastName}
                                onChange={(changeEvent) => {
                                    setFormLastName(changeEvent.target.value);
                                    if (formErrors.lastName) setFormErrors((prev) => ({ ...prev, lastName: undefined }));
                                }}
                                required
                                error={formErrors.lastName}
                            />
                        </div>

                        {/* 4. EMAIL */}
                        <TextField
                            label="Email"
                            placeholder="Enter Email"
                            value={formEmail}
                            suffixButton={constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}
                            onChange={(changeEvent) => {
                                let val = changeEvent.target.value;
                                if (val.includes('@')) {
                                    val = val.replace(/@.*$/, '');
                                }
                                setFormEmail(val);
                                if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                            }}
                            required
                            error={formErrors.email}
                        />

                        {/* 5. ROLE (SWAPPED BEFORE DEPARTMENT) */}
                        <SelectField
                            label="Role"
                            value={formRole}
                            onChange={(value) => {
                                handleRoleChange(value);
                                if (formErrors.role) setFormErrors((prev) => ({ ...prev, role: undefined }));
                            }}
                            options={ROLE_OPTIONS}
                            placeholder="Select Role"
                            required
                            error={formErrors.role}
                        />

                        {/* 6. DEPARTMENT */}
                        <SelectField
                            label="Department"
                            value={isRoleLockedToRMO ? resolvedRmoId : formDepartmentId}
                            onChange={(value) => {
                                setFormDepartmentId(value);
                                if (formErrors.departmentId) setFormErrors((prev) => ({ ...prev, departmentId: undefined }));
                            }}
                            options={creationDepartmentOptions}
                            placeholder="Select Department"
                            isDisabled={isRoleLockedToRMO}
                            helperText={isRoleLockedToRMO ? 'Required for this role.' : undefined}
                            required
                            error={formErrors.departmentId}
                        />
                    </div>
                </Modal>
            )}

            {/* EDIT USER MODAL (SIZE LG) */}
            {editingUser && (
                <Modal
                    isOpen={Boolean(editingUser)}
                    onClose={handleCloseModals}
                    size="lg"
                    title="Edit User Profile"
                    description={`Update records for ${editingUser.universityId} (${editingUser.firstName} ${editingUser.lastName}).`}
                    icon={UserCog}
                    callout="Modifications to role or department will take effect upon the user's next authenticated session."
                    calloutVariant="neutral"
                    onConfirm={handleUpdateUser}
                    confirmLabel={isUpdatingUser ? 'Saving Changes...' : 'Save Changes'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isUpdatingUser}
                    isConfirmDisabled={isUpdatingUser}
                >
                    <div className="flex flex-col gap-5 py-2">
                        {/* AVATAR PREVIEW & UPLOAD */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-surface-hover/40 border border-surface-border">
                            <Avatar
                                src={formAvatarFile ? URL.createObjectURL(formAvatarFile) : formAvatarPath}
                                alt={`${formFirstName} ${formLastName}`}
                                size="large"
                                className="h-20 w-20 rounded-full aspect-square shadow-md ring-2 ring-surface-border shrink-0 text-xl"
                            />
                            <div className="flex flex-col justify-center items-center sm:items-start gap-2 flex-1 text-center sm:text-left">
                                <div>
                                    <h4 className="text-sm font-bold text-text">
                                        {formFirstName} {formLastName}
                                    </h4>
                                    <p className="text-xs text-text-muted mt-0.5">
                                        {editingUser.universityId} · {editingUser.email}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        ref={editAvatarInputRef}
                                        onChange={(changeEvent) => setFormAvatarFile(changeEvent.target.files?.[0] ?? null)}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => editAvatarInputRef.current?.click()}
                                        className="px-3 py-1.5 rounded-md border border-surface-border bg-surface hover:bg-surface-hover text-xs font-medium text-text inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                                    >
                                        <Upload className="h-3.5 w-3.5" />
                                        {formAvatarFile ? 'Change Photo' : 'Upload New Photo'}
                                    </button>
                                    {formAvatarFile && (
                                        <button
                                            type="button"
                                            onClick={() => setFormAvatarFile(null)}
                                            className="px-2 py-1.5 rounded-md text-xs text-error hover:bg-error-background transition-colors cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* UNIVERSITY ID (READ ONLY) */}
                        <TextField
                            label="University ID"
                            value={formUniversityId}
                            isDisabled={true}
                            helperText="University ID cannot be altered once registered."
                        />

                        {/* NAMES */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <TextField
                                label="First Name"
                                placeholder="Enter First Name"
                                value={formFirstName}
                                onChange={(changeEvent) => {
                                    setFormFirstName(changeEvent.target.value);
                                    if (editFormErrors.firstName) setEditFormErrors((prev) => ({ ...prev, firstName: undefined }));
                                }}
                                required
                                error={editFormErrors.firstName}
                            />
                            <TextField
                                label="Middle Name"
                                placeholder="Enter Middle Name"
                                value={formMiddleName}
                                onChange={(changeEvent) => setFormMiddleName(changeEvent.target.value)}
                            />
                            <TextField
                                label="Last Name"
                                placeholder="Enter Last Name"
                                value={formLastName}
                                onChange={(changeEvent) => {
                                    setFormLastName(changeEvent.target.value);
                                    if (editFormErrors.lastName) setEditFormErrors((prev) => ({ ...prev, lastName: undefined }));
                                }}
                                required
                                error={editFormErrors.lastName}
                            />
                        </div>

                        {/* EMAIL */}
                        <TextField
                            label="Email"
                            placeholder="Enter Email"
                            value={formEmail}
                            suffixButton={constants.INSTITUTIONAL_CONFIGURATION.EMAIL_DOMAIN}
                            onChange={(changeEvent) => {
                                let val = changeEvent.target.value;
                                if (val.includes('@')) {
                                    val = val.replace(/@.*$/, '');
                                }
                                setFormEmail(val);
                                if (editFormErrors.email) setEditFormErrors((prev) => ({ ...prev, email: undefined }));
                            }}
                            required
                            error={editFormErrors.email}
                        />

                        {/* ROLE & DEPARTMENT (SWAPPED ORDER) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <SelectField
                                label="Role"
                                value={formRole}
                                onChange={(value) => {
                                    handleRoleChange(value);
                                    if (editFormErrors.role) setEditFormErrors((prev) => ({ ...prev, role: undefined }));
                                }}
                                options={ROLE_OPTIONS}
                                placeholder="Select Role"
                                required
                                error={editFormErrors.role}
                            />
                            <SelectField
                                label="Department"
                                value={isRoleLockedToRMO ? resolvedRmoId : formDepartmentId}
                                onChange={(value) => {
                                    setFormDepartmentId(value);
                                    if (editFormErrors.departmentId) setEditFormErrors((prev) => ({ ...prev, departmentId: undefined }));
                                }}
                                options={departmentFormOptions}
                                placeholder="Select Department"
                                isDisabled={isRoleLockedToRMO}
                                helperText={isRoleLockedToRMO ? 'Required for this role.' : undefined}
                                required
                                error={editFormErrors.departmentId}
                            />
                        </div>
                    </div>
                </Modal>
            )}

            {/* SUSPEND / UNSUSPEND USER CONFIRMATION MODAL */}
            {suspendingUser && (() => {
                const isSelf = Boolean(
                    currentUser && (
                        suspendingUser.id === currentUser.id ||
                        (suspendingUser.universityId && currentUser.universityId === suspendingUser.universityId)
                    )
                );
                const isCurrentlySuspended = Boolean(
                    suspendingUser._isUnsuspending ||
                    String(suspendingUser.status || '').toUpperCase() === constants.USERS_STATUS.SUSPENDED
                );
                const isBlocked = isSelf && !isCurrentlySuspended;

                return (
                    <Modal
                        isOpen={Boolean(suspendingUser)}
                        onClose={handleCloseModals}
                        title={
                            isCurrentlySuspended
                                ? 'Unsuspend User Account'
                                : 'Suspend User Account'
                        }
                        description={
                            isCurrentlySuspended
                                ? `Are you sure you want to unsuspend ${suspendingUser.firstName} ${suspendingUser.lastName} (${suspendingUser.universityId})? The user will be restored to ${useUserStore.getState().getPreviousStatus(suspendingUser.id) || 'VERIFIED'}.`
                                : `Are you sure you want to suspend ${suspendingUser.firstName} ${suspendingUser.lastName} (${suspendingUser.universityId})? The user will be immediately logged out and prohibited from institutional authentication.`
                        }
                        icon={isCurrentlySuspended ? UserCheck : UserX}
                        callout={
                            isBlocked
                                ? 'Safety Guard: You cannot suspend your own account. Only another system administrator can suspend this account.'
                                : isCurrentlySuspended
                                ? 'The user will regain institutional access and credentials upon confirmation.'
                                : 'The user will be immediately logged out and prohibited from institutional authentication.'
                        }
                        calloutVariant={isBlocked ? 'destructive' : (isCurrentlySuspended ? 'accent' : 'destructive')}
                        onConfirm={handleToggleSuspendUser}
                        confirmLabel={
                            isSuspendingLoading
                                ? 'Updating Status...'
                                : isBlocked
                                ? 'Self-Suspension Prohibited'
                                : isCurrentlySuspended
                                ? 'Unsuspend User'
                                : 'Suspend User'
                        }
                        cancelLabel="Cancel"
                        variant={isCurrentlySuspended ? 'primary' : 'destructive'}
                        isConfirmLoading={isSuspendingLoading}
                        isConfirmDisabled={isSuspendingLoading || isBlocked}
                    />
                );
            })()}

            {/* DELETE USER CONFIRMATION MODAL */}
            {deletingUser && (
                <Modal
                    isOpen={Boolean(deletingUser)}
                    onClose={handleCloseModals}
                    title="Delete User"
                    description={`Are you sure you want to delete ${deletingUser.firstName} ${deletingUser.lastName} (${deletingUser.universityId})? This action cannot be undone and will revoke all sessions.`}
                    icon={Trash2}
                    callout="This action cannot be undone and will permanently revoke all authenticated sessions and permissions."
                    calloutVariant="destructive"
                    onConfirm={handleDeleteUser}
                    confirmLabel={isDeletingUserLoading ? 'Deleting User...' : 'Delete User'}
                    cancelLabel="Cancel"
                    variant="destructive"
                    isConfirmLoading={isDeletingUserLoading}
                    isConfirmDisabled={isDeletingUserLoading}
                />
            )}
        </Container>
    );
};


// --- EXPORTS ---
export { UsersPage };
export default UsersPage;
