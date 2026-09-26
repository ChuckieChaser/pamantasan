// --- IMPORTS ---
import { z } from 'zod';
import { TimestampSchema } from '../../schemas';


// --- FOREIGN SCHEMAS ---
export const DepartmentForeignSchema = z.object({
    id: z.string().uuid(),
    logo: z.string().max(256).nullable(),
    name: z.string().min(1).max(128),
    code: z.string().min(1).max(32),
});


// --- DEPARTMENT SCHEMAS ---
export const DepartmentSchema = z.object({
    id: z.string().uuid(),
    logo: z.string().max(256).nullable(),
    name: z.string().min(1).max(128),
    code: z.string().min(1).max(32),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export const CreateDepartmentSchema = z.object({
    logo: z.string().max(256).nullable().optional(),
    name: z.string().min(1).max(128),
    code: z.string().min(1).max(32),
});

export const UpdateDepartmentSchema = z.object({
    id: z.string().uuid(),
    logo: z.string().max(256).nullable().optional(),
    name: z.string().min(1).max(128).optional(),
    code: z.string().min(1).max(32).optional(),
    updatedAt: TimestampSchema.optional(),
});

export const DeleteDepartmentsSchema = z.object({
    ids: z.array(z.string().uuid()).min(1),
});
