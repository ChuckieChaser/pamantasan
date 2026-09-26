// --- IMPORTS ---
import { z } from 'zod';
import { UserEmailSchema } from '../../schemas';


// --- AUTH SCHEMAS ---
export const UniversityIdSchema = z
    .string()
    .trim()
    .min(1, 'University ID is required')
    .max(32, 'University ID must not exceed 32 characters');

export const PasswordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters');

export const OtpSchema = z
    .string()
    .length(6, 'Verification code must be 6 digits');

export const LoginSchema = z.object({
    identifier: z.string().trim().min(1, 'University ID or Email is required').max(64),
    password: z.string().min(1, 'Password is required'),
    otp: OtpSchema.optional().nullable(),
    token: z.string().optional().nullable(),
});

export const loginSchema = LoginSchema;

export const StepUpOtpSchema = z.object({
    otp: OtpSchema,
    token: z.string().min(1, 'Verification token is required'),
});

export const ForgotPasswordSchema = z.object({
    email: UserEmailSchema,
});

export const VerificationSchema = z.object({
    email: UserEmailSchema,
    otp: OtpSchema,
});

export const ResetPasswordSchema = z
    .object({
        email: UserEmailSchema,
        otp: OtpSchema,
        password: PasswordSchema,
        confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

export const ChangePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: PasswordSchema,
        confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
        message: 'New passwords do not match',
        path: ['confirmNewPassword'],
    });
