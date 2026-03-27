import { z } from 'zod'

const expenseBaseSchema = z.object({
  property_id: z.string().uuid(),
  department_id: z.string().uuid(),
  category: z.enum([
    'CONSUMABLES', 'SALARIES', 'FOOD_KITCHEN', 'FUEL', 'TAXES_FEES',
    'MAINTENANCE', 'UTILITIES', 'MARKETING', 'INSURANCE', 'ACCOUNTING', 'OTHER',
  ]),
  supplier: z.string().min(1),
  supplier_eik: z.string().nullable().optional(),
  document_type: z.enum(['INVOICE', 'EXPENSE_ORDER', 'RECEIPT', 'NO_DOCUMENT']),
  document_number: z.string().nullable().optional(),
  issue_date: z.string().date(),
  due_date: z.string().date(),
  amount_net: z.number().positive(),
  vat_amount: z.number().min(0),
  payment_method: z.enum(['BANK_TRANSFER', 'CASH', 'CARD', 'OTHER']),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
})

export const createExpenseSchema = expenseBaseSchema.refine(
  (data) => data.document_type !== 'NO_DOCUMENT' || (data.note && data.note.length > 0),
  { message: 'Бележка е задължителна при липса на документ', path: ['note'] }
)

export const updateExpenseSchema = expenseBaseSchema.partial()

// Rule #5: attachment required before SENT_TO_CO (except EXPENSE_ORDER with note)
export const submitExpenseSchema = expenseBaseSchema.refine(
  (data) => {
    if (data.document_type === 'EXPENSE_ORDER' && data.note && data.note.length > 0) return true
    return data.attachment_url != null && data.attachment_url.length > 0
  },
  { message: 'Прикачен файл е задължителен при изпращане', path: ['attachment_url'] }
).refine(
  (data) => data.document_type !== 'NO_DOCUMENT' || (data.note && data.note.length > 0),
  { message: 'Бележка е задължителна при липса на документ', path: ['note'] }
)

export const payExpenseSchema = z.object({
  expense_id: z.string().uuid(),
  paid_amount: z.number().positive(),
  paid_at: z.string().date(),
  paid_from_cash: z.string().nullable().optional(),
})
