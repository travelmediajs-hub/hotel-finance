import { z } from 'zod'

export const createIncomeEntrySchema = z.object({
  entry_date: z.string().date(),
  property_id: z.string().uuid(),
  type: z.enum([
    'INC_BANK', 'INC_CASH', 'INC_ADV', 'INC_DEP', 'INC_OTHER',
    'INC_CREDIT_NOTE',
    'CF_CREDIT', 'CF_TRANSFER',
  ]),
  amount: z.number().refine(v => v !== 0, { message: 'Сумата не може да е 0' }),
  bank_account_id: z.string().uuid().nullable().optional(),
  payment_method: z.enum(['BANK', 'CASH']),
  payer: z.string().min(1),
  description: z.string().nullable().optional(),
  period_from: z.string().date().nullable().optional(),
  period_to: z.string().date().nullable().optional(),
  loan_id: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  account_id: z.string().uuid(),
}).refine(
  (data) => data.type !== 'CF_CREDIT' || data.loan_id != null,
  { message: 'Кредит е задължителен при CF_CREDIT', path: ['loan_id'] }
)

export const updateIncomeEntrySchema = z.object({
  entry_date: z.string().date().optional(),
  type: z.enum([
    'INC_BANK', 'INC_CASH', 'INC_ADV', 'INC_DEP', 'INC_OTHER',
    'INC_CREDIT_NOTE',
    'CF_CREDIT', 'CF_TRANSFER',
  ]).optional(),
  amount: z.number().refine(v => v !== 0, { message: 'Сумата не може да е 0' }).optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
  payment_method: z.enum(['BANK', 'CASH']).optional(),
  payer: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  period_from: z.string().date().nullable().optional(),
  period_to: z.string().date().nullable().optional(),
  loan_id: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  account_id: z.string().uuid().optional(),
})

export const realizeAdvanceSchema = z.object({
  income_entry_id: z.string().uuid(),
})
