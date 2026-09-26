// --- IMPORTS ---
import { useCallback, useEffect, useState } from 'react';
import { useDepartment } from './useDepartment';


// --- HOOK ---
export const useDepartmentForm = ({
    initialData = null,
    isOpen = false,
    onSuccess,
    onClose,
} = {}) => {
    // --- HOOKS & STATE ---
    const { handleCreateDepartment, handleUpdateDepartment, isMutating } = useDepartment();

    const isEditMode = Boolean(initialData?.id);

    const getInitialState = useCallback(() => {
        if (initialData) {
            return {
                name: initialData.name ?? '',
                code: initialData.code ?? '',
            };
        }
        return { name: '', code: '' };
    }, [initialData]);

    const [formData, setFormData] = useState(getInitialState);
    const [errors, setErrors] = useState({});

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
        if (!formData.name.trim()) newErrors.name = 'Department name is required';
        if (!formData.code.trim()) newErrors.code = 'Department code is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleSubmit = useCallback(async (event) => {
        event?.preventDefault?.();
        if (!validate()) return;

        let result;
        if (isEditMode) {
            result = await handleUpdateDepartment(initialData.id, {
                name: formData.name.trim(),
                code: formData.code.trim().toUpperCase(),
            });
        } else {
            result = await handleCreateDepartment({
                name: formData.name.trim(),
                code: formData.code.trim().toUpperCase(),
            });
        }

        onSuccess?.(result, isEditMode);
        onClose?.();
        return result;
    }, [validate, isEditMode, initialData?.id, formData, handleUpdateDepartment, handleCreateDepartment, onSuccess, onClose]);

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
