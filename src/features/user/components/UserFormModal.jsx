// --- IMPORTS ---
import { UserPlus, UserCog } from 'lucide-react';
import { Modal } from '../../../components/feedback/Modal';
import { FormField } from '../../../components/forms/FormField';
import { Input } from '../../../components/forms/Input';
import { Select } from '../../../components/forms/Select';
import { useToast } from '../../../components/feedback/ToastProvider';
import { useUserForm } from '../hooks/useUserForm';
import { USER_ROLE, USER_STATUS } from '../userConstants';


// --- CONFIGURATIONS ---
const ROLE_OPTIONS = Object.values(USER_ROLE).map((role) => ({
    value: role,
    label: role,
}));

const STATUS_OPTIONS = Object.values(USER_STATUS).map((status) => ({
    value: status,
    label: status.replace(/_/g, ' '),
}));


// --- COMPONENTS ---
export const UserFormModal = ({
    isOpen = false,
    onClose,
    initialData = null,
    departments = [],
}) => {
    // --- HOOKS & STATE ---
    const { toast } = useToast();

    const {
        formData,
        errors,
        isEditMode,
        isSubmitting,
        handleChange,
        handleSubmit,
    } = useUserForm({
        initialData,
        departments,
        isOpen,
        onClose,
        onSuccess: (result, wasEdit) => {
            toast.success(
                wasEdit ? 'User updated' : 'User created',
                wasEdit
                    ? `${formData.givenName} ${formData.lastName} was updated successfully.`
                    : `${formData.givenName} ${formData.lastName} has been registered.`
            );
        },
    });

    const onSubmit = async (event) => {
        try {
            await handleSubmit(event);
        } catch (err) {
            toast.error(isEditMode ? 'Failed to update user' : 'Failed to create user', err?.message, err);
        }
    };

    // --- RENDER ---
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditMode ? 'Edit User Record' : 'Register New User'}
            description={isEditMode ? 'Update user identity, role, and department assignment.' : 'Create a new university record and provision system access.'}
            icon={isEditMode ? UserCog : UserPlus}
            confirmLabel={isEditMode ? 'Save Changes' : 'Create User'}
            onConfirm={onSubmit}
            isConfirmLoading={isSubmitting}
            size="md"
        >
            <form
                onSubmit={onSubmit}
                className="flex flex-col gap-4 py-1"
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                        label="First Name"
                        isRequired
                        errorMessage={errors.givenName}
                    >
                        <Input
                            value={formData.givenName}
                            onChange={(e) => handleChange('givenName', e.target.value)}
                            placeholder="e.g. Maria"
                            hasError={Boolean(errors.givenName)}
                        />
                    </FormField>

                    <FormField
                        label="Last Name"
                        isRequired
                        errorMessage={errors.lastName}
                    >
                        <Input
                            value={formData.lastName}
                            onChange={(e) => handleChange('lastName', e.target.value)}
                            placeholder="e.g. Santos"
                            hasError={Boolean(errors.lastName)}
                        />
                    </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                        label="University ID"
                        isRequired
                        errorMessage={errors.universityId}
                    >
                        <Input
                            value={formData.universityId}
                            onChange={(e) => handleChange('universityId', e.target.value)}
                            placeholder="e.g. 21-12345"
                            isDisabled={isEditMode}
                            hasError={Boolean(errors.universityId)}
                        />
                    </FormField>

                    <FormField
                        label="Email Address"
                        isRequired
                        errorMessage={errors.email}
                    >
                        <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="e.g. user@pamantasan.edu.ph"
                            isDisabled={isEditMode}
                            hasError={Boolean(errors.email)}
                        />
                    </FormField>
                </div>

                <FormField
                    label="Department"
                    isRequired
                    errorMessage={errors.departmentId}
                >
                    <Select
                        value={formData.departmentId}
                        onChange={(e) => handleChange('departmentId', e.target.value)}
                        placeholder="Choose a department..."
                        options={departments.map((dept) => ({
                            value: dept.id,
                            label: dept.name,
                        }))}
                        hasError={Boolean(errors.departmentId)}
                    />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Role Assignment">
                        <Select
                            value={formData.role}
                            onChange={(e) => handleChange('role', e.target.value)}
                            options={ROLE_OPTIONS}
                        />
                    </FormField>

                    {isEditMode && (
                        <FormField label="Account Status">
                            <Select
                                value={formData.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                                options={STATUS_OPTIONS}
                            />
                        </FormField>
                    )}
                </div>
            </form>
        </Modal>
    );
};
