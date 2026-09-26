// --- IMPORTS ---
import { Building2, Calendar, Edit3, Hash, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Panel } from '../../../components/layout/Panel';
import { useDialog } from '../../../components/feedback/DialogProvider';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useDepartment } from '../hooks/useDepartment';


// --- COMPONENTS ---
export const DepartmentInspector = ({
    department = null,
    isOpen = false,
    onClose,
    onEdit,
}) => {
    // --- HOOKS & STATE ---
    const { handleDeleteDepartments, isMutating } = useDepartment();
    const { confirm } = useDialog();
    const { toast } = useToast();

    // Guard: Hidden if no department or not open
    if (!isOpen || !department) {
        return null;
    }

    // --- HANDLERS ---
    const handleDelete = async () => {
        const confirmed = await confirm({
            title: 'Delete Department?',
            description: `Are you sure you want to delete ${department.name}? All associated assignments may be orphaned or unlinked.`,
            confirmLabel: 'Delete Department',
            variant: 'destructive',
            icon: Trash2,
        });

        if (!confirmed) return;

        try {
            await handleDeleteDepartments([department.id]);
            toast.success('Department deleted', `${department.name} was removed successfully.`);
            onClose?.();
        } catch (err) {
            toast.error('Failed to delete department', err?.message, err);
        }
    };

    // --- RENDER ---
    return (
        <Panel
            isOpen={isOpen}
            onClose={onClose}
            title="Department Details"
            subtitle={department.code}
            icon={Building2}
        >
            <div className="flex flex-col gap-6">
                {/* Header Card */}
                <div className="flex flex-col items-center text-center p-4 rounded-xl bg-surface-hover/50 border border-surface-border gap-3">
                    <div className="h-12 w-12 rounded-xl bg-accent-background border border-accent-border text-accent flex items-center justify-center shrink-0">
                        <Building2 className="h-6 w-6" />
                    </div>

                    <div className="flex flex-col items-center">
                        <h4 className="text-base font-bold text-text">
                            {department.name}
                        </h4>
                        <Badge variant="accent" size="sm" className="mt-1">
                            {department.code}
                        </Badge>
                    </div>
                </div>

                {/* Attributes */}
                <div className="flex flex-col gap-3">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Information
                    </span>

                    <div className="flex flex-col divide-y divide-surface-border text-xs rounded-lg border border-surface-border bg-surface overflow-hidden">
                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted inline-flex items-center gap-2">
                                <Hash className="h-3.5 w-3.5" />
                                <span>Department Code</span>
                            </span>
                            <span className="font-semibold text-text select-text">
                                {department.code}
                            </span>
                        </div>

                        <div className="p-3 flex items-center justify-between">
                            <span className="text-text-muted inline-flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Registered At</span>
                            </span>
                            <span className="font-medium text-text">
                                {department.createdAt ? new Date(department.createdAt).toLocaleDateString() : '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Management Actions */}
                <div className="flex flex-col gap-2 pt-2">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Management
                    </span>

                    <Button
                        variant="secondary"
                        leadingIcon={Edit3}
                        label="Edit Department"
                        onClick={() => onEdit?.(department)}
                        className="w-full justify-start"
                    />

                    <Button
                        variant="destructive"
                        leadingIcon={Trash2}
                        label="Delete Department"
                        onClick={handleDelete}
                        isLoading={isMutating}
                        className="w-full justify-start"
                    />
                </div>
            </div>
        </Panel>
    );
};
