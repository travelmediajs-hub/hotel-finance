import { z } from 'zod'

export const createWithdrawalSchema = z.object({
  property_id: z.string().uuid(),
  cash_register: z.string().min(1),
  amount: z.number().positive(),
  withdrawn_by: z.string().min(1),
  purpose: z.enum([
    'PAY_EXP', 'PAY_SAL', 'ADV_EMP', 'ADV_OPS',
    'BANK_IN', 'CASH_TRANS', 'CO_COLLECT', 'OTHER',
  ]),
  description: z.string().nullable().optional(),
  expense_id: z.string().uuid().nullable().optional(),
  employee_id: z.string().uuid().nullable().optional(),
  target_cash: z.string().nullable().optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
}).refine(
  (data) => !['ADV_EMP', 'ADV_OPS', 'OTHER'].includes(data.purpose) ||
    (data.description && data.description.length > 0),
  { message: 'Описание е задължително за аванс/друго', path: ['description'] }
)

export const accountWithdrawalSchema = z.object({
  withdrawal_id: z.string().uuid(),
  accounted_amount: z.number().min(0),
  accounted_date: z.string().date(),
})

export const voidWithdrawalSchema = z.object({
  withdrawal_id: z.string().uuid(),
  void_reason: z.string().min(1, 'Причина за анулиране е задължителна'),
})
