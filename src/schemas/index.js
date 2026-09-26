// --- IMPORTS ---
import { z } from 'zod';
import { SYSTEM } from '../constants';


// --- GLOBAL SCHEMAS ---
export const UserEmailSchema = z
    .string()
    .email('Invalid email address')
    .endsWith(
        SYSTEM.EMAIL_DOMAIN,
        `Email must belong to ${SYSTEM.EMAIL_DOMAIN}`
    );

export const TimestampSchema = z
    .string()
    .or(z.date().transform((date) => date.toISOString()));
