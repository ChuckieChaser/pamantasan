// --- IMPORTS ---
import { useCallback, useEffect, useState } from 'react';
import { useUser } from './useUser';
import { USER_ROLE, USER_STATUS } from '../userConstants';


// --- HOOK ---
export const useUserForm = ({
    initialData = null,
    departments = [],
    isOpen = false,
    onSuccess,
    onClose,
} = {}) => {
    // --- HOOKS & STATE ---
    const { handleCreateUser, handleUpdateUser, isMutating } = useUser();

    const isEditMode = Boolean(initialData?.id);

    const getInitialState = useCallback(() => {
        if (initialData) {
            return {
                givenName:    initialData.givenName ?? '',
                lastName:     initialData.lastName ?? '',
                universityId: initialData.universityId ?? '',
                email:        initialData.email ?? '',
                departmentId: initialData.department?.id ?? initialData.departmentId ?? '',
                role:         initialData.role ?? USER_ROLE.MEMBER,
                status:       initialData.status ?? USER_STATUS.VERIFIED,
            };
        }

        return {
            givenName:    '',
            lastName:     '',
            universityId: '',
            email:        '',
            departmentId: departments[0]?.id ?? '',
            role:         USER_ROLE.MEMBER,
            status:       USER_STATUS.VERIFIED,
        };
    }, [initialData, departments]);

    const [formData, setFormData] = useState(getInitialState);
    const [errors, setErrors] = useState({});

    // Sync form state when modal opens or initial data changes
    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialState());
            setErrors({});
        }
    }, [isOpen, getInitialState]);

    // --- HANDLERS ---
    const handleChange = useCallback((field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
    }, []);

    const validate = useCallback(() => {
        const newErrors = {};
        if (!formData.givenName.trim()) newErrors.givenName = 'First name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.universityId.trim()) newErrors.universityId = 'University ID is required';
        if (!formData.email.trim() || !formData.email.includes('@')) newErrors.email = 'Valid email is required';
        if (!formData.departmentId) newErrors.departmentId = 'Department is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleSubmit = useCallback(async (event) => {
        event?.preventDefault?.();
        if (!validate()) return;

        let result;
        if (isEditMode) {
            result = await handleUpdateUser(initialData.id, {
                givenName:    formData.givenName.trim(),
                lastName:     formData.lastName.trim(),
                departmentId: formData.departmentId,
                role:         formData.role,
                status:       formData.status,
            });
        } else {
            result = await handleCreateUser({
                id:           crypto.randomUUID(),
                givenName:    formData.givenName.trim(),
                lastName:     formData.lastName.trim(),
                universityId: formData.universityId.trim(),
                email:        formData.email.trim().toLowerCase(),
                departmentId: formData.departmentId,
                role:         formData.role,
                passwordHash: 'TEMP_PLACEHOLDER_HASH',
            });
        }

        onSuccess?.(result, isEditMode);
        onClose?.();
        return result;
    }, [validate, isEditMode, initialData?.id, formData, handleUpdateUser, handleCreateUser, onSuccess, onClose]);

    const resetForm = useCallback(() => {
        setFormData(getInitialState());
        setErrors({});
    }, [getInitialState]);

    return {
        // State
        formData,
        errors,
        isEditMode,
        isSubmitting: isMutating,

        // Handlers
        handleChange,
        handleSubmit,
        resetForm,
        setFormData,
    };
};
