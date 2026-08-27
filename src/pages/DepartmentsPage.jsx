// --- IMPORTS ---
import { useState, useMemo } from 'react';
import {
    Building2,
    Plus,
    Edit3,
    Trash2,
    Users,
    CheckCircle2,
} from 'lucide-react';
import {
    PageContainer,
    Browser,
    TextField,
    Modal,
    useToast,
} from '../components';
import { useDepartmentStore, useUserStore } from '../stores';

// --- CONFIGURATIONS ---
const DEPARTMENT_COLUMNS = [
    { key: 'code', label: 'Code' },
    { key: 'title', label: 'Department / College Name' },
    { key: 'memberCount', label: 'Faculty & Staff' },
    { key: 'date', label: 'Established' },
];

const DEPARTMENT_SORT_OPTIONS = [
    { value: 'name-asc', label: 'Name (A to Z)', icon: Building2 },
    { value: 'name-desc', label: 'Name (Z to A)', icon: Building2 },
    { value: 'date-desc', label: 'Recently Added', icon: CheckCircle2 },
    { value: 'date-asc', label: 'Oldest Added', icon: CheckCircle2 },
];

// --- COMPONENTS ---
const DepartmentsPage = ({
    currentUser = null,
    onSelectDepartment = null,
    className,
    ...props
}) => {
    // HOOKS
    const { showToast } = useToast();

    // STORES
    const departments = useDepartmentStore((state) => state.departments);
    const createDepartment = useDepartmentStore((state) => state.createDepartment);
    const updateDepartment = useDepartmentStore((state) => state.updateDepartment);
    const deleteDepartment = useDepartmentStore((state) => state.deleteDepartment);
    const users = useUserStore((state) => state.users);

    // STATES
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [deletingDepartment, setDeletingDepartment] = useState(null);

    // FORM STATES
    const [formCode, setFormCode] = useState('');
    const [formName, setFormName] = useState('');
    const [formError, setFormError] = useState('');

    // DERIVED VALUES
    const formattedDepartmentData = useMemo(() => {
        return departments.map((department) => {
            const count = users.filter((user) => user.department_id === department.id).length;
            return {
                ...department,
                id: department.id,
                code: department.code,
                title: department.name,
                name: department.name,
                subtitle: department.code,
                description: department.description ?? `${department.name} collegiate department and academic operations.`,
                division: department.division ?? 'Academic Division',
                department_head: department.department_head ?? 'Office of the Dean',
                faculty_count: department.faculty_count ?? (count > 0 ? count : 12),
                memberCount: `${count > 0 ? count : (department.faculty_count ?? 12)} members`,
                metadata: `${department.code} · ${count > 0 ? count : (department.faculty_count ?? 12)} members`,
                department: department.name,
                created_at: department.created_at,
                updated_at: department.updated_at ?? department.created_at,
                date: new Date(department.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
                badge: department.code,
            };
        });
    }, [departments, users]);

    // HANDLERS
    const handleSelectDepartment = (item) => {
        setSelectedDepartment(item);
        onSelectDepartment?.(item);
    };

    const handleOpenAddModal = () => {
        setFormCode('');
        setFormName('');
        setFormError('');
        setIsAddModalOpen(true);
    };

    const handleOpenEditModal = (departmentItem) => {
        const rawDepartment = departments.find((department) => department.id === departmentItem.id) ?? departmentItem;
        setEditingDepartment(rawDepartment);
        setFormCode(rawDepartment.code);
        setFormName(rawDepartment.name);
        setFormError('');
    };

    const handleCloseModals = () => {
        setIsAddModalOpen(false);
        setEditingDepartment(null);
        setDeletingDepartment(null);
        setFormError('');
    };

    const handleItemAction = (actionKey, item) => {
        if (actionKey === 'open') {
            handleSelectDepartment(item);
            return;
        }

        if (actionKey === 'edit') {
            handleOpenEditModal(item);
            return;
        }

        if (actionKey === 'delete') {
            const rawDepartment = departments.find((department) => department.id === item.id) ?? item;
            setDeletingDepartment(rawDepartment);
            return;
        }
    };

    const handleCreateDepartment = async () => {
        if (!formCode.trim() || !formName.trim()) {
            setFormError('Department code and name are both required.');
            return;
        }

        try {
            await createDepartment({
                code: formCode.trim().toUpperCase(),
                name: formName.trim(),
            });

            showToast({
                type: 'success',
                title: 'Department Created',
                description: `Successfully added ${formCode.toUpperCase()} (${formName.trim()}).`,
            });
            handleCloseModals();
        } catch (error) {
            setFormError(error?.message ?? 'Failed to create department.');
        }
    };

    const handleUpdateDepartment = async () => {
        if (!editingDepartment) {
            return;
        }

        if (!formCode.trim() || !formName.trim()) {
            setFormError('Department code and name are both required.');
            return;
        }

        try {
            await updateDepartment(editingDepartment.id, {
                code: formCode.trim().toUpperCase(),
                name: formName.trim(),
            });

            showToast({
                type: 'success',
                title: 'Department Updated',
                description: `Department details updated for ${formCode.toUpperCase()}.`,
            });
            handleCloseModals();
        } catch (error) {
            setFormError(error?.message ?? 'Failed to update department.');
        }
    };

    const handleDeleteDepartment = async () => {
        if (!deletingDepartment) {
            return;
        }

        try {
            await deleteDepartment(deletingDepartment.id);
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
        }
    };

    return (
        <PageContainer className={`flex flex-col gap-6 ${className ?? ''}`} {...props}>
            <Browser
                resourceName="departments"
                title="Manage Departments"
                description="Configure collegiate divisions, departments, and academic office codes."
                data={formattedDepartmentData}
                columns={DEPARTMENT_COLUMNS}
                sortOptions={DEPARTMENT_SORT_OPTIONS}
                selectedItem={selectedDepartment}
                addItemLabel="Add Department"
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
                    title="Add New Department"
                    description="Create an institutional department code and division title."
                    onConfirm={handleCreateDepartment}
                    confirmLabel="Create Department"
                    cancelLabel="Cancel"
                >
                    <div className="flex flex-col gap-4 py-2">
                        {formError && (
                            <div className="p-3 rounded-lg bg-error-background border border-error-border text-xs text-error">
                                {formError}
                            </div>
                        )}
                        <TextField
                            label="Department Code"
                            placeholder="e.g. CCS, HR, CAS"
                            value={formCode}
                            onChange={(changeEvent) => setFormCode(changeEvent.target.value.toUpperCase())}
                            helper="Standard uppercase institutional abbreviation."
                        />
                        <TextField
                            label="Department Full Name"
                            placeholder="e.g. College of Computer Studies"
                            value={formName}
                            onChange={(changeEvent) => setFormName(changeEvent.target.value)}
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
                    onConfirm={handleUpdateDepartment}
                    confirmLabel="Save Changes"
                    cancelLabel="Cancel"
                >
                    <div className="flex flex-col gap-4 py-2">
                        {formError && (
                            <div className="p-3 rounded-lg bg-error-background border border-error-border text-xs text-error">
                                {formError}
                            </div>
                        )}
                        <TextField
                            label="Department Code"
                            placeholder="e.g. CCS, HR"
                            value={formCode}
                            onChange={(changeEvent) => setFormCode(changeEvent.target.value.toUpperCase())}
                        />
                        <TextField
                            label="Department Full Name"
                            placeholder="e.g. College of Computer Studies"
                            value={formName}
                            onChange={(changeEvent) => setFormName(changeEvent.target.value)}
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
                    description={`Are you sure you want to delete "${deletingDepartment.name}" (${deletingDepartment.code})? This action cannot be undone.`}
                    onConfirm={handleDeleteDepartment}
                    confirmLabel="Delete Department"
                    cancelLabel="Cancel"
                    variant="destructive"
                />
            )}
        </PageContainer>
    );
};

export default DepartmentsPage;
