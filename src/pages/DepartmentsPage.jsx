// --- IMPORTS ---
import { useState, useMemo, useEffect } from 'react';
import {
    Building2,
    Plus,
    CheckCircle2,
    Trash2,
} from 'lucide-react';
import {
    Browser,
    Container,
    Modal,
    TextField,
    formatDateTime,
} from '../components';
import { useDepartmentStore, useUserStore, useAuthStore, useCoordinatorStore } from '../stores';
import { useToast, useAuth } from '../hooks';
import { coordinatorApprovalService } from '../services';
import { constants } from '../constants';

// --- CONFIGURATIONS ---
const DEPARTMENT_COLUMNS = [
    { key: 'code', label: 'Code' },
    { key: 'title', label: 'Name' },
    { key: 'memberCount', label: 'Faculty & Staff' },
    { key: 'date', label: 'Created At' },
];

const DEPARTMENT_SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A to Z)', icon: Building2 },
    { value: 'name-desc', label: 'Name (Z to A)', icon: Building2 },
    { value: 'date-desc', label: 'Recently Added', icon: CheckCircle2 },
    { value: 'date-asc', label: 'Oldest Added', icon: CheckCircle2 },
];

// --- COMPONENTS ---
const DepartmentsPage = ({
    currentUser: propUser = null,
    selectedItem = null,
    onSelectDepartment = null,
    className,
    ...props
}) => {
    // STORES
    const departments = useDepartmentStore((state) => state.departments);
    const fetchDepartments = useDepartmentStore((state) => state.fetchDepartments);
    const insertDepartment = useDepartmentStore((state) => state.insertDepartment);
    const updateDepartment = useDepartmentStore((state) => state.updateDepartment);
    const deleteDepartment = useDepartmentStore((state) => state.deleteDepartment);
    const users = useUserStore((state) => state.users);
    const { currentUser: authUser } = useAuth();
    const storeUser = useAuthStore((state) => state.currentUser);
    const currentUser = propUser ?? authUser ?? storeUser ?? useAuthStore.getState().currentUser;
    const isCoordinator = constants.isCoordinatorRole(currentUser?.role);

    // STATES
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [deletingDepartment, setDeletingDepartment] = useState(null);

    const [isCreatingDepartment, setIsCreatingDepartment] = useState(false);
    const [isUpdatingDepartment, setIsUpdatingDepartment] = useState(false);
    const [isDeletingDepartmentLoading, setIsDeletingDepartmentLoading] = useState(false);

    const [formCode, setFormCode] = useState('');
    const [formName, setFormName] = useState('');
    const [formErrors, setFormErrors] = useState({});
    const [editFormErrors, setEditFormErrors] = useState({});

    // EFFECTS
    useEffect(() => {
        fetchDepartments();
    }, [fetchDepartments]);

    // LISTEN FOR EXTERNAL DELETE TRIGGER (E.G. FROM INSPECTOR QUICK ACTION)
    useEffect(() => {
        const handleDeleteDeptEvent = (event) => {
            if (event.detail) {
                const targetDept = departments.find((d) => d?.id === event.detail.id) ?? event.detail;
                setDeletingDepartment(targetDept);
            }
        };
        window.addEventListener('pamantasan:delete-department', handleDeleteDeptEvent);
        return () => window.removeEventListener('pamantasan:delete-department', handleDeleteDeptEvent);
    }, [departments]);

    // HOOKS
    const { showToast } = useToast();

    // HANDLERS
    const handleSelectDepartment = (item, targetTab = 'information') => {
        const itemWithTab = item ? { ...item, _targetTab: targetTab } : null;
        setSelectedDepartment(itemWithTab);
        onSelectDepartment?.(itemWithTab, targetTab);
    };

    const handleOpenAddModal = () => {
        setFormCode('');
        setFormName('');
        setFormErrors({});
        setIsAddModalOpen(true);
    };

    const handleOpenEditModal = (departmentItem) => {
        const rawDepartment = departments.find((department) => department?.id === departmentItem.id) ?? departmentItem;
        setEditingDepartment(rawDepartment);
        setFormCode(rawDepartment.code);
        setFormName(rawDepartment.name);
        setEditFormErrors({});
    };

    const handleCloseModals = () => {
        if (isCreatingDepartment || isUpdatingDepartment || isDeletingDepartmentLoading) {
            return;
        }
        setIsAddModalOpen(false);
        setEditingDepartment(null);
        setDeletingDepartment(null);
        setFormErrors({});
        setEditFormErrors({});
    };

    const handleItemAction = (actionKey, item) => {
        if (actionKey === 'open' || actionKey === 'view_information') {
            handleSelectDepartment(item, 'information');
            return;
        }

        if (actionKey === 'view_faculty') {
            handleSelectDepartment(item, 'faculty');
            return;
        }

        if (actionKey === 'edit') {
            handleOpenEditModal(item);
            return;
        }

        if (actionKey === 'delete') {
            const rawDepartment = departments.find((department) => department?.id === item.id) ?? item;
            setDeletingDepartment(rawDepartment);
            return;
        }
    };

    const handleCreateDepartment = async () => {
        const errors = {};
        if (!formCode.trim()) errors.code = 'Code is required.';
        if (!formName.trim()) errors.name = 'Name is required.';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setIsCreatingDepartment(true);
        setFormErrors({});
        try {
            if (isCoordinator) {
                const deptPayload = {
                    code: formCode.trim().toUpperCase(),
                    name: formName.trim(),
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_CREATE,
                    requesterId: requesterId,
                    data: deptPayload,
                });

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Department creation request for "${formCode.toUpperCase()}" sent for Administrator approval.`,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
                handleCloseModals();
                return;
            }

            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            await Promise.all([
                insertDepartment({
                    code: formCode.trim().toUpperCase(),
                    name: formName.trim(),
                }),
                minTimer,
            ]);

            showToast({
                type: 'success',
                title: 'Department Created',
                description: `Successfully added ${formCode.toUpperCase()} (${formName.trim()}).`,
            });
            handleCloseModals();
        } catch (error) {
            setFormErrors({ code: error?.message ?? 'Failed to create department.' });
        } finally {
            setIsCreatingDepartment(false);
        }
    };

    const handleUpdateDepartment = async () => {
        if (!editingDepartment) {
            return;
        }

        const errors = {};
        if (!formCode.trim()) errors.code = 'Code is required.';
        if (!formName.trim()) errors.name = 'Name is required.';

        if (Object.keys(errors).length > 0) {
            setEditFormErrors(errors);
            return;
        }

        setIsUpdatingDepartment(true);
        setEditFormErrors({});
        try {
            if (isCoordinator) {
                const deptPayload = {
                    departmentId: editingDepartment.id,
                    old: {
                        code: editingDepartment.code,
                        name: editingDepartment.name,
                    },
                    new: {
                        code: formCode.trim().toUpperCase(),
                        name: formName.trim(),
                    },
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_UPDATE,
                    requesterId: requesterId,
                    data: deptPayload,
                });

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Department update request for "${formCode.toUpperCase()}" sent for Administrator approval.`,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
                handleCloseModals();
                return;
            }

            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            const [updated] = await Promise.all([
                updateDepartment(editingDepartment.id, {
                    code: formCode.trim().toUpperCase(),
                    name: formName.trim(),
                }),
                minTimer,
            ]);

            if (selectedDepartment?.id === editingDepartment.id) {
                const refreshed = {
                    ...selectedDepartment,
                    ...updated,
                    code: updated.code,
                    title: updated.name,
                    name: updated.name,
                    updatedAt: updated.updatedAt,
                };
                setSelectedDepartment(refreshed);
                onSelectDepartment?.(refreshed);
            }

            showToast({
                type: 'success',
                title: 'Department Updated',
                description: `Department details updated for ${formCode.toUpperCase()}.`,
            });
            handleCloseModals();
        } catch (error) {
            setEditFormErrors({ code: error?.message ?? 'Failed to update department.' });
        } finally {
            setIsUpdatingDepartment(false);
        }
    };

    const deletingDeptAssignedUsers = useMemo(() => {
        if (!deletingDepartment) return 0;
        return (users || []).filter(
            (u) =>
                u.departmentId === deletingDepartment.id ||
                u.department === deletingDepartment.name ||
                u.department === `${deletingDepartment.code} — ${deletingDepartment.name}` ||
                u.department === deletingDepartment.code
        ).length;
    }, [deletingDepartment, users]);

    const handleDeleteDepartment = async () => {
        if (!deletingDepartment) {
            return;
        }

        if (deletingDeptAssignedUsers > 0) {
            showToast({
                type: 'error',
                title: 'Cannot Delete Department',
                description: `This department has ${deletingDeptAssignedUsers} active member(s). Reassign or remove them first.`,
            });
            return;
        }

        setIsDeletingDepartmentLoading(true);
        try {
            if (isCoordinator) {
                const deptPayload = {
                    departmentId: deletingDepartment.id,
                    code: deletingDepartment.code,
                    name: deletingDepartment.name,
                };

                const requesterId = currentUser?.id ?? useAuthStore.getState().currentUser?.id;
                await coordinatorApprovalService.submitCoordinatorRequest({
                    action: constants.COORDINATOR_REQUESTS_ACTION.DEPARTMENT_DELETE,
                    requesterId: requesterId,
                    data: deptPayload,
                });

                showToast({
                    type: 'success',
                    title: 'Request Submitted',
                    description: `Department deletion request for "${deletingDepartment.code}" sent for Administrator approval.`,
                });
                useCoordinatorStore.getState().fetchCoordinatorRequests().catch(() => {});
                handleCloseModals();
                return;
            }

            const minTimer = new Promise((resolve) => setTimeout(resolve, 500));
            await Promise.all([
                deleteDepartment(deletingDepartment.id),
                minTimer,
            ]);
            if (selectedDepartment?.id === deletingDepartment.id) {
                setSelectedDepartment(null);
                onSelectDepartment?.(null);
            }
            showToast({
                type: 'success',
                title: 'Department Removed',
                description: `Department ${deletingDepartment.code} has been deleted.`,
            });
            handleCloseModals();
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Deletion Failed',
                description: error?.message ?? 'Could not delete department.',
            });
        } finally {
            setIsDeletingDepartmentLoading(false);
        }
    };

    // DERIVED VALUES
    const activeSelectedDepartment = useMemo(() => {
        const targetId = selectedItem?.id ?? selectedDepartment?.id;
        if (!targetId) return null;
        const matched = departments.find((d) => d?.id === targetId);
        if (!matched) return selectedItem ?? selectedDepartment;
        return {
            ...selectedDepartment,
            ...matched,
            title: matched.name,
            subtitle: matched.code,
            createdAt: matched.createdAt,
            updatedAt: matched.updatedAt,
        };
    }, [departments, selectedDepartment, selectedItem]);

    const formattedDepartmentData = useMemo(() => {
        return departments.filter(Boolean).map((department) => {
            const count = users.filter((user) =>
                user?.departmentId === department.id ||
                user?.department === department.name
            ).length;
            const createdAtDate = department.createdAt || new Date().toISOString();
            const updatedAtDate = department.updatedAt || createdAtDate;
            return {
                id: department.id,
                code: department.code ?? '',
                title: department.name ?? department.code ?? 'Unnamed Department',
                name: department.name ?? department.code ?? 'Unnamed Department',
                subtitle: department.code ?? '',
                memberCount: `${count} personnel`,
                metadata: `${department.code ?? ''} · ${count} personnel`,
                createdAt: createdAtDate,
                updatedAt: updatedAtDate,
                date: (updatedAtDate || createdAtDate) && !isNaN(new Date(updatedAtDate || createdAtDate).getTime())
                    ? formatDateTime(updatedAtDate || createdAtDate)
                    : 'Active',
                badge: department.code ?? '',
            };
        });
    }, [departments, users]);

    // RENDER
    return (
        <Container
            variant="page"
            className={`flex flex-col gap-6 ${className ?? ''}`}
            {...props}
        >
            <Browser
                resourceName="departments"
                title="Manage Departments"
                description="Configure institutional departments and academic office codes."
                data={formattedDepartmentData}
                columns={DEPARTMENT_COLUMNS}
                sortOptions={DEPARTMENT_SORT_OPTIONS}
                selectedItem={activeSelectedDepartment}
                addItemLabel="New Department"
                addItemIcon={Plus}
                searchPlaceholder="Search departments by code or name..."
                onAddItem={handleOpenAddModal}
                onSelectItem={handleSelectDepartment}
                onOpenItem={handleSelectDepartment}
                onItemAction={handleItemAction}
            />

            {/* ADD DEPARTMENT MODAL */}
            {isAddModalOpen && (
                <Modal
                    isOpen={isAddModalOpen}
                    onClose={handleCloseModals}
                    title="New Department"
                    description="Create an institutional department code and name."
                    icon={Building2}
                    callout="Departments organize institutional faculty, academic document shares, and university workflows."
                    calloutVariant="neutral"
                    onConfirm={handleCreateDepartment}
                    confirmLabel={isCreatingDepartment ? 'Creating Department...' : 'Create Department'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isCreatingDepartment}
                    isConfirmDisabled={isCreatingDepartment}
                >
                    <div className="flex flex-col gap-4 py-2">
                        <TextField
                            label="Code"
                            placeholder="Enter your department code"
                            value={formCode}
                            onChange={(changeEvent) => {
                                setFormCode(changeEvent.target.value.toUpperCase());
                                if (formErrors.code) setFormErrors((prev) => ({ ...prev, code: undefined }));
                            }}
                            helperText="Uppercase code."
                            required
                            error={formErrors.code}
                        />
                        <TextField
                            label="Name"
                            placeholder="Enter your department name"
                            value={formName}
                            onChange={(changeEvent) => {
                                setFormName(changeEvent.target.value);
                                if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                            }}
                            required
                            error={formErrors.name}
                        />
                    </div>
                </Modal>
            )}

            {/* EDIT DEPARTMENT MODAL */}
            {editingDepartment && (
                <Modal
                    isOpen={Boolean(editingDepartment)}
                    onClose={handleCloseModals}
                    title="Edit Department"
                    description={`Update records for ${editingDepartment.code}.`}
                    icon={Building2}
                    callout="Modifying department properties will update associated faculty rosters and access rules."
                    calloutVariant="neutral"
                    onConfirm={handleUpdateDepartment}
                    confirmLabel={isUpdatingDepartment ? 'Saving Changes...' : 'Save Changes'}
                    cancelLabel="Cancel"
                    isConfirmLoading={isUpdatingDepartment}
                    isConfirmDisabled={isUpdatingDepartment}
                >
                    <div className="flex flex-col gap-4 py-2">
                        <TextField
                            label="Code"
                            placeholder="Enter your department code"
                            value={formCode}
                            onChange={(changeEvent) => {
                                setFormCode(changeEvent.target.value.toUpperCase());
                                if (editFormErrors.code) setEditFormErrors((prev) => ({ ...prev, code: undefined }));
                            }}
                            required
                            error={editFormErrors.code}
                        />
                        <TextField
                            label="Name"
                            placeholder="Enter your department name"
                            value={formName}
                            onChange={(changeEvent) => {
                                setFormName(changeEvent.target.value);
                                if (editFormErrors.name) setEditFormErrors((prev) => ({ ...prev, name: undefined }));
                            }}
                            required
                            error={editFormErrors.name}
                        />
                    </div>
                </Modal>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deletingDepartment && (
                <Modal
                    isOpen={Boolean(deletingDepartment)}
                    onClose={handleCloseModals}
                    title="Delete Department"
                    description={
                        deletingDeptAssignedUsers > 0
                            ? `Cannot delete "${deletingDepartment.name}" (${deletingDepartment.code}) because ${deletingDeptAssignedUsers} user(s) are currently assigned to this department.`
                            : `Are you sure you want to delete "${deletingDepartment.name}" (${deletingDepartment.code})? This action cannot be undone.`
                    }
                    icon={Trash2}
                    callout={
                        deletingDeptAssignedUsers > 0
                            ? `Safety Guard: You must reassign or remove all ${deletingDeptAssignedUsers} member(s) before this department can be deleted.`
                            : 'This action cannot be undone and will permanently remove this department record.'
                    }
                    calloutVariant="destructive"
                    onConfirm={handleDeleteDepartment}
                    confirmLabel={
                        deletingDeptAssignedUsers > 0
                            ? 'Deletion Blocked'
                            : isDeletingDepartmentLoading
                            ? 'Deleting Department...'
                            : 'Delete Department'
                    }
                    cancelLabel="Cancel"
                    variant="destructive"
                    isConfirmLoading={isDeletingDepartmentLoading}
                    isConfirmDisabled={isDeletingDepartmentLoading || deletingDeptAssignedUsers > 0}
                />
            )}
        </Container>
    );
};

// --- EXPORTS ---
export { DepartmentsPage };
export default DepartmentsPage;
