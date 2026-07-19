import { z } from 'zod';

// --- AUTH SCHEMAS ---

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    code: z.string().length(6, 'Reset code must be exactly 6 digits'),
    passwordNew: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    avatar: z.string().url('Avatar must be a valid URL').optional().nullable(),
    passwordOld: z.string().optional(),
    passwordNew: z.string().min(6, 'New password must be at least 6 characters').optional(),
  }),
});

// --- HOUSEHOLD SCHEMAS ---

export const createHouseholdSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Household name must be at least 2 characters'),
  }),
});

export const inviteEmailSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const joinByCodeSchema = z.object({
  body: z.object({
    code: z.string().min(4, 'Code is too short'),
  }),
});

export const changeRoleSchema = z.object({
  body: z.object({
    role: z.enum(['OWNER', 'MEMBER']),
  }),
});

// --- EXPENSE SCHEMAS ---

export const createExpenseSchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Title must be at least 2 characters'),
    description: z.string().optional(),
    amount: z.number().positive('Amount must be positive'),
    categoryId: z.number().int('Category ID must be an integer'),
    date: z.string().datetime({ message: 'Date must be a valid ISO datetime' }).transform((val) => new Date(val)),
    paidById: z.number().int(),
    splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']),
    splits: z.array(
      z.object({
        userId: z.number().int(),
        value: z.number().nonnegative('Split value must be non-negative').optional(),
      })
    ).min(1, 'At least one split participant is required'),
    notes: z.string().optional(),
  }),
});

export const createRecurringSchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Title must be at least 2 characters'),
    description: z.string().optional(),
    amount: z.number().positive('Amount must be positive'),
    categoryId: z.number().int('Category ID must be an integer'),
    paidById: z.number().int(),
    interval: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    startDate: z.string().datetime({ message: 'Start date must be a valid ISO datetime' }).transform((val) => new Date(val)),
  }),
});

// --- SETTLEMENT SCHEMAS ---

export const recordSettlementSchema = z.object({
  body: z.object({
    fromUserId: z.number().int(),
    toUserId: z.number().int(),
    amount: z.number().positive('Amount must be positive'),
    date: z.string().datetime({ message: 'Date must be a valid ISO datetime' }).transform((val) => new Date(val)).optional(),
  }),
});

export const upiQRCodeSchema = z.object({
  query: z.object({
    upiId: z.string().min(3, 'UPI ID is required'),
    payeeName: z.string().min(1, 'Payee name is required'),
    amount: z.string().transform((val) => parseFloat(val)),
    note: z.string().optional().default('Settle up expense'),
  }),
});
