// --- IMPORTS ---
import { useEffect, useMemo, useState } from 'react';
import {
    Building2,
    ChevronRight,
    Edit3,
    Plus,
    Search,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/forms/Input';
import { FormField } from '../../../components/forms/FormField';
import { Modal } from '../../../components/feedback/Modal';
import { LoadingSpinner } from '../../../components/feedback/LoadingSpinner';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useDepartment } from '../hooks/useDepartment';
import { useDepartmentForm } from '../hooks/useDepartmentForm';
import { DepartmentInspector } from './DepartmentInspector';


// --- COMPONENTS ---
export const DepartmentExplorer = () => {
    // --- HOOKS & STATE ---
    const {
        departments,
        isLoading,
        isMutating,
        handleGetDepartments,
        selectedDepartment,
        setSelectedDepartment,
    } = useDepartment();

    const { toast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState(null);

    const {
        formData,
        errors,
        isEditMode,
        isSubmitting,
        handleChange,
        handleSubmit,
    } = useDepartmentForm({
        initialData: editingDepartment,
        isOpen: isModalOpen,
        onSuccess: (_result, wasEdit) => {
            toast.success(
                wasEdit ? 'Department updated' : 'Department created',
                wasEdit ? `${formData.name} was updated successfully.` : `${formData.name} has been created.`
            );
            setIsModalOpen(false);
        },
        onClose: () => setIsModalOpen(false),
    });

    useEffect(() => {
        handleGetDepartments();
    }, [handleGetDepartments]);

    // --- DERIVED VALUES ---
    const filteredDepartments = useMemo(() => {
        if (!searchQuery.trim()) return departments ?? [];
        const query = searchQuery.toLowerCase().trim();
        return (departments ?? []).filter((dept) => {
            const name = (dept.name ?? '').toLowerCase();
            const code = (dept.code ?? '').toLowerCase();
            return name.includes(query) || code.includes(query);
        });
    }, [departments, searchQuery]);

    // --- HANDLERS ---
    const handleOpenCreateModal = () => {
        setEditingDepartment(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (dept) => {
        setEditingDepartment(dept);
        setIsModalOpen(true);
    };

    const handleSaveDepartment = async (e) => {
        try {
            await handleSubmit(e);
        } catch (err) {
            toast.error(isEditMode ? 'Failed to update department' : 'Failed to create department', err?.message, err);
        }
    };

    // --- RENDER ---
    return (
        <div className="flex flex-col gap-5 w-full">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by department name or code..."
                    leadingIcon={Search}
                    isClearable
                    onClear={() => setSearchQuery('')}
                    className="sm:w-80"
                />

                <Button
                    variant="primary"
                    leadingIcon={Plus}
                    label="Add Department"
                    onClick={handleOpenCreateModal}
                    className="shrink-0"
                />
            </div>

            {/* Department Directory Viewport */}
            {isLoading && (!departments || departments.length === 0) ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <LoadingSpinner size="lg" />
                    <span className="text-xs text-text-muted">Loading departments...</span>
                </div>
            ) : filteredDepartments.length === 0 ? (
                <div className="py-16 text-center rounded-xl border border-dashed border-surface-border bg-surface/50 p-6 flex flex-col items-center justify-center gap-2">
                    <Building2 className="h-8 w-8 text-text-muted opacity-50" />
                    <h3 className="text-sm font-semibold text-text">No departments found</h3>
                    <p className="text-xs text-text-muted max-w-sm">
                        No departments match your current search criteria.
                    </p>
                </div>
            ) : (
                <>
                    {/* Mobile Card List (sm:hidden) */}
                    <div className="flex sm:hidden flex-col gap-2.5">
                        {filteredDepartments.map((dept) => {
                            const isSelected = selectedDepartment?.id === dept.id;

                            return (
                                <Card
                                    key={dept.id}
                                    variant="interactive"
                                    padding="sm"
                                    onClick={() => setSelectedDepartment(dept)}
                                    className={isSelected ? 'border-accent ring-1 ring-accent' : ''}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-center shrink-0 text-text-muted">
                                            <Building2 className="h-4 w-4" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="text-sm font-semibold text-text truncate">
                                                    {dept.name}
                                                </h4>
                                                <Badge variant="accent" size="sm">
                                                    {dept.code}
                                                </Badge>
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
                                    <th className="py-3 px-4">Department Name</th>
                                    <th className="py-3 px-4">Code</th>
                                    <th className="py-3 px-4">Created Date</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-border text-sm">
                                {filteredDepartments.map((dept) => {
                                    const isSelected = selectedDepartment?.id === dept.id;

                                    return (
                                        <tr
                                            key={dept.id}
                                            onClick={() => setSelectedDepartment(dept)}
                                            className={`hover:bg-surface-hover/70 cursor-pointer transition-colors ${
                                                isSelected ? 'bg-accent/5' : ''
                                            }`}
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-surface-hover border border-surface-border flex items-center justify-center shrink-0 text-text-muted">
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-semibold text-text truncate">
                                                        {dept.name}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <Badge variant="neutral" size="sm">
                                                    {dept.code}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-4 text-xs text-text-muted">
                                                {dept.createdAt ? new Date(dept.createdAt).toLocaleDateString() : '—'}
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
                                                        onClick={() => handleOpenEditModal(dept)}
                                                        title="Edit department"
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

            {/* Department Inspector */}
            <DepartmentInspector
                department={selectedDepartment}
                isOpen={Boolean(selectedDepartment)}
                onClose={() => setSelectedDepartment(null)}
                onEdit={handleOpenEditModal}
            />

            {/* Create/Edit Department Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingDepartment ? 'Edit Department' : 'Create Department'}
                description={editingDepartment ? 'Update department name and organizational code.' : 'Provision a new organizational academic or administrative department.'}
                icon={Building2}
                confirmLabel={editingDepartment ? 'Save Changes' : 'Create Department'}
                onConfirm={handleSaveDepartment}
                isConfirmLoading={isSubmitting}
                size="sm"
            >
                <form onSubmit={handleSaveDepartment} className="flex flex-col gap-4 py-1">
                    <FormField
                        label="Department Name"
                        isRequired
                        errorMessage={errors.name}
                    >
                        <Input
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="e.g. College of Engineering"
                            hasError={Boolean(errors.name)}
                        />
                    </FormField>

                    <FormField
                        label="Department Code"
                        isRequired
                        errorMessage={errors.code}
                    >
                        <Input
                            value={formData.code}
                            onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                            placeholder="e.g. COE"
                            hasError={Boolean(errors.code)}
                        />
                    </FormField>
                </form>
            </Modal>
        </div>
    );
};
