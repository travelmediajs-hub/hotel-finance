import { z } from 'zod'

export const createIncomeEntrySchema = z.object({
  entry_date: z.string().date(),
  property_id: z.string().uuid(),
  type: z.enum([
    'INC_BANK', 'INC_CASH', 'INC_ADV', 'INC_DEP', 'INC_OTHER',
    'CF_CREDIT', 'CF_TRANSFER',
  ]),
  amount: z.number().positive(),
  bank_account_id: z.string().uuid().nullable().optional(),
  payment_method: z.enum(['BANK', 'CASH']),
  payer: z.string().min(1),
  description: z.string().nullable().optional(),
  period_from: z.string().date().nullable().optional(),
  period_to: z.string().date().nullable().optional(),
  loan_id: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  income_category: z.enum([
    'ACCOMMODATION', 'FB', 'SPA', 'FEES', 'COMMISSIONS', 'OTHER',
  ]).nullable().optional(),
}).refine(
  (data) => {
    const isIncome = data.type.startsWith('INC_')
    return !isIncome || data.income_category != null
  },
  { message: 'Категория е задължителна за приходни типове', path: ['income_category'] }
).refine(
  (data) => data.type !== 'CF_CREDIT' || data.loan_id != null,
  { message: 'Кредит е задължителен при CF_CREDIT', path: ['loan_id'] }
)

export const realizeAdvanceSchema = z.object({
  income_entry_id: z.string().uuid(),
})
