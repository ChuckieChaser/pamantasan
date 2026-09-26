// --- IMPORTS ---
import { z } from 'zod';

import { TimestampSchema, UserEmailSchema } from '../../schemas';
import { USER_ROLE, USER_STATUS, USER_SETTING_THEME, USER_SETTING_NOTIFICATION } from './userConstants';

import { DepartmentForeignSchema } from '../department/departmentSchema';


// --- FOREIGN SCHEMAS ---
export const UserForeignSchema = z.object({
    id: z.string().uuid(),
    avatar: z.string().max(256).nullable(),
    role: z.enum(Object.values(USER_ROLE)),
    email: UserEmailSchema,
    givenName: z.string().min(1).max(64),
    lastName: z.string().min(1).max(64),
});


// --- USER SCHEMAS ---
export const UserSchema = z.object({
    id: z.string().uuid(),
    universityId: z.string().min(1).max(32),
    department: DepartmentForeignSchema,
    role: z.enum(Object.values(USER_ROLE)),
    email: UserEmailSchema,
    avatar: z.string().max(256).nullable(),
    givenName: z.string().min(1).max(64),
    lastName: z.string().min(1).max(64),
    status: z.enum(Object.values(USER_STATUS)),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const CreateUserSchema = z.object({
    id: z.string().uuid(),
    universityId: z.string().min(1).max(32),
    departmentId: z.string().uuid(),
    role: z.enum(Object.values(USER_ROLE)),
    email: UserEmailSchema,
    avatar: z.string().max(256).nullable().optional(),
    givenName: z.string().min(1).max(64),
    lastName: z.string().min(1).max(64),
    passwordHash: z.string().min(1).max(256).optional().nullable(),
    googleId: z.string().max(256).nullable().optional(),
});

export const UpdateUserSchema = z.object({
    id: z.string().uuid(),
    departmentId: z.string().uuid().optional(),
    role: z.enum(Object.values(USER_ROLE)).optional(),
    email: UserEmailSchema.optional(),
    avatar: z.string().max(256).nullable().optional(),
    givenName: z.string().min(1).max(64).optional(),
    lastName: z.string().min(1).max(64).optional(),
    status: z.enum(Object.values(USER_STATUS)).optional(),
    updatedAt: TimestampSchema.optional(),
});

export const UpdateUsersSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
    departmentId: z.string().uuid().optional(),
    role: z.enum(Object.values(USER_ROLE)).optional(),
    status: z.enum(Object.values(USER_STATUS)).optional(),
    updatedAt: TimestampSchema.optional(),
});


// --- USER CREDENTIAL SCHEMAS ---
export const UserCredentialSchema = z.object({
    user: z.object({ id: z.string().uuid() }),
    passwordHash: z.string().min(1).max(256),
    googleId: z.string().max(256).nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const UpdateUserCredentialSchema = z.object({
    userId: z.string().uuid(),
    passwordHash: z.string().min(1).max(256).optional(),
    googleId: z.string().max(256).nullable().optional(),
    updatedAt: TimestampSchema.optional(),
});


// --- USER SETTING SCHEMAS ---
export const UserSettingSchema = z.object({
    user: z.object({ id: z.string().uuid() }),
    theme: z.enum(Object.values(USER_SETTING_THEME)),
    notification: z.enum(Object.values(USER_SETTING_NOTIFICATION)),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const UpdateUserSettingSchema = z.object({
    userId: z.string().uuid(),
    theme: z.enum(Object.values(USER_SETTING_THEME)).optional(),
    notification: z.enum(Object.values(USER_SETTING_NOTIFICATION)).optional(),
    updatedAt: TimestampSchema.optional(),
});


// --- USER SESSION SCHEMAS ---
export const UserSessionSchema = z.object({
    id: z.string().uuid(),
    user: z.object({ id: z.string().uuid() }),
    tokenHash: z.string().min(1).max(256),
    ipAddress: z.string().max(64).nullable(),
    userAgent: z.string().max(256).nullable(),
    createdAt: TimestampSchema,
    expiredAt: TimestampSchema.nullable(),
});

export const CreateUserSessionSchema = z.object({
    userId: z.string().uuid(),
    tokenHash: z.string().min(1).max(256),
    ipAddress: z.string().max(64).nullable().optional(),
    userAgent: z.string().max(256).nullable().optional(),
    expiredAt: TimestampSchema.nullable().optional(),
});

export const UpdateUserSessionSchema = z.object({
    id: z.string().uuid(),
    expiredAt: TimestampSchema,
});

export const DeleteUserSessionsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});
