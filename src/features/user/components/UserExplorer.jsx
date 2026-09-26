// --- IMPORTS ---
import { useEffect, useMemo, useState } from 'react';
import {
    Building2,
    ChevronRight,
    Edit3,
    Search,
    Shield,
    UserPlus,
    Users,
} from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/forms/Input';
import { Select } from '../../../components/forms/Select';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { useUser } from '../hooks/useUser';
import { USER_ROLE, USER_STATUS } from '../userConstants';
import { UserFormModal } from './UserFormModal';
import { UserInspector } from './UserInspector';


// --- CONFIGURATIONS ---
const ROLE_FILTER_OPTIONS = [
    { value: '', label: 'All Roles' },
    ...Object.values(USER_ROLE).map((role) => ({
        value: role,
        label: role,
    })),
];

const STATUS_FILTER_OPTIONS = [
    { value: '', label: 'All Statuses' },
    ...Object.values(USER_STATUS).map((status) => ({
        value: status,
        label: status.replace(/_/g, ' '),
    })),
];

const STATUS_BADGE_VARIANT = {
    [USER_STATUS.VERIFIED]:         'success',
    [USER_STATUS.PENDING_PASSWORD]: 'warning',
    [USER_STATUS.PENDING_SSO]:      'information',
    [USER_STATUS.SUSPENDED]:        'error',
    [USER_STATUS.ARCHIVED]:         'neutral',
};


// --- COMPONENTS ---
export const UserExplorer = ({ departments = [] }) => {
    // --- HOOKS & STATE ---
    const { users, isLoading, handleGetUsers, selectedUser, setSelectedUser } = useUser();

    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Initial load
    useEffect(() => {
        handleGetUsers();
    }, [handleGetUsers]);

    // --- DERIVED VALUES ---
    const filteredUsers = useMemo(() => {
        return (users ?? []).filter((u) => {
            const matchesRole = !roleFilter || u.role === roleFilter;
            const matchesStatus = !statusFilter || u.status === statusFilter;

            if (!matchesRole || !matchesStatus) return false;

            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase().trim();
            const fullName = `${u.givenName ?? ''} ${u.lastName ?? ''}`.toLowerCase();
            const email = (u.email ?? '').toLowerCase();
            const uniId = (u.universityId ?? '').toLowerCase();
            const deptName = (u.department?.name ?? '').toLowerCase();

            return fullName.includes(query) || email.includes(query) || uniId.includes(query) || deptName.includes(query);
        });
    }, [users, searchQuery, roleFilter, statusFilter]);

    // --- HANDLERS ---
    const handleOpenCreateModal = () => {
        setEditingUser(null);
        setIsFormModalOpen(true);
    };

    const handleOpenEditModal = (user) => {
        setEditingUser(user);
        setIsFormModalOpen(true);
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
    };

    const handleCloseInspector = () => {
        setSelectedUser(null);
    };

    // --- RENDER ---
    return (
        <div className="flex flex-col gap-5 w-full">
            {/* Top Toolbar (36px Controls) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, ID, or email..."
                        leadingIcon={Search}
                        isClearable
                        onClear={() => setSearchQuery('')}
                        className="sm:w-72"
                    />

                    <div className="flex items-center gap-2">
                        <Select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            options={ROLE_FILTER_OPTIONS}
                            className="flex-1 sm:w-36"
                        />

                        <Select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            options={STATUS_FILTER_OPTIONS}
                            className="flex-1 sm:w-36"
                        />
                    </div>
                </div>

                <Button
                    variant="primary"
                    leadingIcon={UserPlus}
                    label="Add User"
                    onClick={handleOpenCreateModal}
                    className="shrink-0"
                />
            </div>

            {/* User Directory Viewport */}
            {isLoading && (!users || users.length === 0) ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <LoadingSpinner size="lg" />
                    <span className="text-xs text-text-muted">Loading user directory...</span>
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="py-16 text-center rounded-xl border border-dashed border-surface-border bg-surface/50 p-6 flex flex-col items-center justify-center gap-2">
                    <Users className="h-8 w-8 text-text-muted opacity-50" />
                    <h3 className="text-sm font-semibold text-text">No users found</h3>
                    <p className="text-xs text-text-muted max-w-sm">
                        No user records match your current search criteria. Try modifying your filters or add a new user.
                    </p>
                </div>
            ) : (
                <>
                    {/* Mobile Card List (sm:hidden) */}
                    <div className="flex sm:hidden flex-col gap-2.5">
                        {filteredUsers.map((u) => {
                            const fullName = `${u.givenName ?? ''} ${u.lastName ?? ''}`.trim() || 'User';
                            const isSelected = selectedUser?.id === u.id;
                            const statusVariant = STATUS_BADGE_VARIANT[u.status] ?? 'neutral';

                            return (
                                <Card
                                    key={u.id}
                                    variant="interactive"
                                    padding="sm"
                                    onClick={() => handleSelectUser(u)}
                                    className={isSelected ? 'border-accent ring-1 ring-accent' : ''}
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar
                                            src={u.avatar}
                                            alt={fullName}
                                            size="md"
                                        />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <h4 className="text-sm font-semibold text-text truncate">
                                                    {fullName}
                                                </h4>
                                                <Badge
                                                    variant={statusVariant}
                                                    size="sm"
                                                >
                                                    {u.status?.replace(/_/g, ' ')}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                                                <span className="truncate">{u.universityId}</span>
                                                <span>•</span>
                                                <span className="truncate">{u.department?.name ?? 'General'}</span>
                                            </div>
                                        </div>

                                        <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Desktop Table View (hidden sm:block) */}
                    <div className="hidden sm:block overflow-x-auto rounded-xl border border-surface-border bg-surface shadow-xs">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-surface-border bg-surface-hover/50 text-[11px] font-semibold text-text-muted uppercase tracking-wider select-none">
                                    <th className="py-3 px-4">User</th>
                                    <th className="py-3 px-4">University ID</th>
                                    <th className="py-3 px-4">Department</th>
                                    <th className="py-3 px-4">Role</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-border text-sm">
                                {filteredUsers.map((u) => {
                                    const fullName = `${u.givenName ?? ''} ${u.lastName ?? ''}`.trim() || 'User';
                                    const isSelected = selectedUser?.id === u.id;
                                    const statusVariant = STATUS_BADGE_VARIANT[u.status] ?? 'neutral';

                                    return (
                                        <tr
                                            key={u.id}
                                            onClick={() => handleSelectUser(u)}
                                            className={`hover:bg-surface-hover/70 cursor-pointer transition-colors ${
                                                isSelected ? 'bg-accent/5' : ''
                                            }`}
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        src={u.avatar}
                                                        alt={fullName}
                                                        size="sm"
                                                    />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-semibold text-text truncate">
                                                            {fullName}
                                                        </span>
                                                        <span className="text-xs text-text-muted truncate">
                                                            {u.email}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4 text-xs font-medium text-text select-text">
                                                {u.universityId}
                                            </td>

                                            <td className="py-3 px-4 text-xs text-text truncate max-w-[180px]">
                                                {u.department?.name ?? '—'}
                                            </td>

                                            <td className="py-3 px-4">
                                                <Badge
                                                    variant={u.role === USER_ROLE.ADMINISTRATOR ? 'accent' : 'neutral'}
                                                    size="sm"
                                                >
                                                    {u.role}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-4">
                                                <Badge
                                                    variant={statusVariant}
                                                    size="sm"
                                                >
                                                    {u.status?.replace(/_/g, ' ')}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-4 text-right">
                                                <div
                                                    className="inline-flex items-center gap-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        leadingIcon={Edit3}
                                                        onClick={() => handleOpenEditModal(u)}
                                                        title="Edit user"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Inspector Slide-out / Bottom Sheet */}
            <UserInspector
                user={selectedUser}
                isOpen={Boolean(selectedUser)}
                onClose={handleCloseInspector}
                onEdit={handleOpenEditModal}
            />

            {/* Create / Edit Form Modal */}
            <UserFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                initialData={editingUser}
                departments={departments}
            />
        </div>
    );
};
