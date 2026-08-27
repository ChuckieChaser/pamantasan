// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    Users,
    Plus,
    Edit3,
    Trash2,
    Shield,
    Mail,
    Building2,
    CheckCircle2,
    Clock,
    UserCheck,
} from 'lucide-react';
import {
    PageContainer,
    Browser,
    TextField,
    SelectField,
    RoleBadge,
    Modal,
    UserAvatar,
    useToast,
} from '../components';
import { useUserStore, useDepartmentStore } from '../stores';
import { USER_ROLES, USER_STATUSES } from '../constants';

// --- CONFIGURATIONS ---
const USER_COLUMNS = [
    { key: 'title', label: 'User Name' },
    { key: 'university_id', label: 'University ID' },
    { key: 'department', label: 'Department' },
    { key: 'role', label: 'Institutional Role' },
    { key: 'status', label: 'Account Status' },
    { key: 'date', label: 'Joined' },
];

const USER_SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A to Z)', icon: Users },
    { value: 'name-desc', label: 'Name (Z to A)', icon: Users },
    { value: 'date-desc', label: 'Recently Registered', icon: Clock },
    { value: 'date-asc', label: 'Oldest Registered', icon: Clock },
];

const ROLE_OPTIONS = [
    { value: USER_ROLES.MEMBER, label: 'Member' },
    { value: USER_ROLES.OFFICER, label: 'Officer' },
    { value: USER_ROLES.DIRECTOR, label: 'Director' },
    { value: USER_ROLES.COORDINATOR, label: 'Coordinator' },
    { value: USER_ROLES.ADMINISTRATOR, label: 'Administrator' },
];

// --- COMPONENTS ---
const UsersPage = ({
    currentUser = null,
    onSelectUser = null,
    className,
    ...props
}) => {
    // HOOKS
    const { showToast } = useToast();

    // STORES
    const users = useUserStore((state) => state.users);
    const createUser = useUserStore((state) => state.createUser);
    const updateUser = useUserStore((state) => state.updateUser);
    const deleteUser = useUserStore((state) => state.deleteUser);
    const departments = useDepartmentStore((state) => state.departments);

    // STATES
    const [selectedUser, setSelectedUser] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [deletingUser, setDeletingUser] = useState(null);

    // FORM STATES
    const [formUniversityId, setFormUniversityId] = useState('');
    const [formFirstName, setFormFirstName] = useState('');
    const [formLastName, setFormLastName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formDepartmentId, setFormDepartmentId] = useState('');
    const [formRole, setFormRole] = useState(USER_ROLES.MEMBER);
    const [formError, setFormError] = useState('');

    // DERIVED VALUES
    const departmentFormOptions = useMemo(() => {
        return departments.map((department) => ({ value: department.id, label: `${department.code} — ${department.name}` }));
    }, [departments]);

    const userFilterOptions = useMemo(() => {
        const roleFilters = ROLE_OPTIONS.map((option) => ({
            category: 'Institutional Role',
            value: option.value,
            label: option.label,
            icon: Shield,
        }));

        const departmentFilters = departments.map((department) => ({
            category: 'Department',
            value: department.code,
            label: `${department.code} (${department.name})`,
            icon: Building2,
        }));

        return [...roleFilters, ...departmentFilters];
    }, [departments]);

    const formattedUserData = useMemo(() => {
        return users.map((user) => {
            const department = departments.find((dept) => dept.id === user.department_id);
            const departmentCode = department?.code ?? 'Central';
            const fullName = `${user.first_name} ${user.last_name}`;

            return {
                ...user,
                id: user.id,
                title: fullName,
                name: fullName,
                first_name: user.first_name,
                middle_name: user.middle_name ?? null,
                last_name: user.last_name,
                university_id: user.university_id,
                email: user.email,
                role: user.role,
                department: department?.name ?? departmentCode,
                department_code: departmentCode,
                department_id: user.department_id,
                status: user.status,
                avatar_path: user.avatar_path ?? null,
                metadata: `${user.university_id} · ${departmentCode}`,
                description: `${user.email} — ${user.role} in ${department?.name ?? departmentCode}`,
                created_at: user.created_at,
                updated_at: user.updated_at ?? user.created_at,
                date: new Date(user.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
            };
        });
    }, [users, departments]);

    // HANDLERS
    const handleSelectUser = (item) => {
        setSelectedUser(item);
        onSelectUser?.(item);
    };

    const handleOpenAddModal = () => {
        setFormUniversityId('');
        setFormFirstName('');
        setFormLastName('');
        setFormEmail('');
        setFormDepartmentId(departments[0]?.id ?? '');
        setFormRole(USER_ROLES.MEMBER);
        setFormError('');
        setIsAddModalOpen(true);
    };

    const handleOpenEditModal = (userItem) => {
        const rawUser = users.find((user) => user.id === userItem.id) ?? userItem;
        setEditingUser(rawUser);
        setFormUniversityId(rawUser.university_id);
        setFormFirstName(rawUser.first_name);
        setFormLastName(rawUser.last_name);
        setFormEmail(rawUser.email);
        setFormDepartmentId(rawUser.department_id);
        setFormRole(rawUser.role);
        setFormError('');
    };

    const handleCloseModals = () => {
        setIsAddModalOpen(false);
        setEditingUser(null);
        setDeletingUser(null);
        setFormError('');
    };

    const handleItemAction = (actionKey, item) => {
        if (actionKey === 'open') {
            handleSelectUser(item);
            return;
        }

        if (actionKey === 'edit') {
            handleOpenEditModal(item);
            return;
        }

        if (actionKey === 'delete') {
            const rawUser = users.find((user) => user.id === item.id) ?? item;
            setDeletingUser(rawUser);
            return;
        }
    };

    const handleCreateUser = async () => {
        if (!formUniversityId.trim() || !formFirstName.trim() || !formLastName.trim() || !formEmail.trim() || !formDepartmentId) {
            setFormError('All fields are required.');
            return;
        }

        try {
            await createUser({
                university_id: formUniversityId.trim(),
                first_name: formFirstName.trim(),
                last_name: formLastName.trim(),
                email: formEmail.trim().toLowerCase(),
                department_id: formDepartmentId,
                role: formRole,
                status: USER_STATUSES.VERIFIED,
            });

            showToast({
                type: 'success',
                title: 'User Registered',
                description: `Successfully registered ${formFirstName} ${formLastName} (${formUniversityId}).`,
            });
            handleCloseModals();
        } catch (error) {
            setFormError(error?.message ?? 'Failed to register user.');
        }
    };

    const handleUpdateUser = async () => {
        if (!editingUser) {
            return;
        }

        if (!formFirstName.trim() || !formLastName.trim() || !formDepartmentId) {
            setFormError('First name, last name, and department are required.');
            return;
        }

        try {
            await updateUser(editingUser.id, {
                first_name: formFirstName.trim(),
                last_name: formLastName.trim(),
                department_id: formDepartmentId,
                role: formRole,
            });

            showToast({
                type: 'success',
                title: 'User Updated',
                description: `Updated profile for ${editingUser.university_id}.`,
            });
            handleCloseModals();
        } catch (error) {
            setFormError(error?.message ?? 'Failed to update user.');
        }
    };

    const handleDeleteUser = async () => {
        if (!deletingUser) {
            return;
        }

        try {
            await deleteUser(deletingUser.id);
            showToast({
                type: 'success',
                title: 'User Deleted',
                description: `User ${deletingUser.university_id} has been removed.`,
            });
            handleCloseModals();
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Deletion Failed',
                description: error?.message ?? 'Could not delete user.',
            });
        }
    };

    return (
        <PageContainer className={`flex flex-col gap-6 ${className ?? ''}`} {...props}>
            <Browser
                resourceName="users"
                title="Manage Users"
                data={formattedUserData}
                columns={USER_COLUMNS}
                sortOptions={USER_SORT_OPTIONS}
                filterOptions={userFilterOptions}
                selectedItem={selectedUser}
                addItemLabel="Register User"
                addItemIcon={Plus}
                searchPlaceholder="Search by name, ID, or email..."
                onAddItem={handleOpenAddModal}
                onSelectItem={handleSelectUser}
                onOpenItem={handleSelectUser}
                onItemAction={handleItemAction}
            />

            {/* ADD USER MODAL */}
            {isAddModalOpen && (
                <Modal
                    isOpen={isAddModalOpen}
                    onClose={handleCloseModals}
                    title="Register New User"
                    description="Create institutional account record with role and department assignment."
                    onConfirm={handleCreateUser}
                    confirmLabel="Register User"
                    cancelLabel="Cancel"
                >
                    <div className="flex flex-col gap-4 py-2">
                        {formError && (
                            <div className="p-3 rounded-lg bg-error-background border border-error-border text-xs text-error">
                                {formError}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <TextField
                                label="First Name"
                                placeholder="Arthur"
                                value={formFirstName}
                                onChange={(changeEvent) => setFormFirstName(changeEvent.target.value)}
                            />
                            <TextField
                                label="Last Name"
                                placeholder="Pendragon"
                                value={formLastName}
                                onChange={(changeEvent) => setFormLastName(changeEvent.target.value)}
                            />
                        </div>
                        <TextField
                            label="University ID"
                            placeholder="e.g. 20-00001"
                            value={formUniversityId}
                            onChange={(changeEvent) => setFormUniversityId(changeEvent.target.value)}
                            helper="Pattern: YY-NNNNN"
                        />
                        <TextField
                            label="Institutional Email"
                            placeholder="user@plpasig.edu.ph"
                            value={formEmail}
                            onChange={(changeEvent) => setFormEmail(changeEvent.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <SelectField
                                label="Department"
                                value={formDepartmentId}
                                onChange={(value) => setFormDepartmentId(value)}
                                options={departmentFormOptions}
                            />
                            <SelectField
                                label="Institutional Role"
                                value={formRole}
                                onChange={(value) => setFormRole(value)}
                                options={ROLE_OPTIONS}
                            />
                        </div>
                    </div>
                </Modal>
            )}

            {/* EDIT USER MODAL */}
            {editingUser && (
                <Modal
                    isOpen={Boolean(editingUser)}
                    onClose={handleCloseModals}
                    title="Edit User Details"
                    description={`Update profile for ${editingUser.university_id}.`}
                    onConfirm={handleUpdateUser}
                    confirmLabel="Save Changes"
                    cancelLabel="Cancel"
                >
                    <div className="flex flex-col gap-4 py-2">
                        {formError && (
                            <div className="p-3 rounded-lg bg-error-background border border-error-border text-xs text-error">
                                {formError}
                            </div>
                        )}
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover/50 border border-surface-border">
                            <UserAvatar
                                src={editingUser.avatar_path}
                                name={`${formFirstName} ${formLastName}`}
                                size="lg"
                                className="h-12 w-12 shadow-xs shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                                <span className="font-bold text-sm text-text truncate">
                                    {formFirstName || 'User'} {formLastName}
                                </span>
                                <span className="text-xs text-text-muted truncate">
                                    {editingUser.university_id} · {editingUser.email}
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <TextField
                                label="First Name"
                                value={formFirstName}
                                onChange={(changeEvent) => setFormFirstName(changeEvent.target.value)}
                            />
                            <TextField
                                label="Last Name"
                                value={formLastName}
                                onChange={(changeEvent) => setFormLastName(changeEvent.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <SelectField
                                label="Department"
                                value={formDepartmentId}
                                onChange={(value) => setFormDepartmentId(value)}
                                options={departmentFormOptions}
                            />
                            <SelectField
                                label="Institutional Role"
                                value={formRole}
                                onChange={(value) => setFormRole(value)}
                                options={ROLE_OPTIONS}
                            />
                        </div>
                    </div>
                </Modal>
            )}

            {/* DELETE USER CONFIRMATION MODAL */}
            {deletingUser && (
                <Modal
                    isOpen={Boolean(deletingUser)}
                    onClose={handleCloseModals}
                    title="Delete User"
                    description={`Are you sure you want to delete ${deletingUser.first_name} ${deletingUser.last_name} (${deletingUser.university_id})? This will also remove all associated sessions.`}
                    onConfirm={handleDeleteUser}
                    confirmLabel="Delete User"
                    cancelLabel="Cancel"
                    variant="destructive"
                />
            )}
        </PageContainer>
    );
};

export default UsersPage;
