import { z } from 'zod'

const expenseBaseSchema = z.object({
  property_id: z.string().uuid(),
  department_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier: z.string().min(1).nullable().optional(),
  supplier_eik: z.string().nullable().optional(),
  document_type: z.enum(['INVOICE', 'EXPENSE_ORDER', 'RECEIPT', 'NO_DOCUMENT', 'CREDIT_NOTE']),
  document_number: z.string().nullable().optional(),
  issue_date: z.string().date(),
  due_date: z.string().date(),
  amount_net: z.number().refine(v => v !== 0, { message: 'Сумата не може да е 0' }),
  vat_amount: z.number(),
  payment_method: z.enum(['BANK_TRANSFER', 'CASH', 'CARD', 'OTHER']),
  bank_account_id: z.string().uuid().nullable().optional(),
  co_cash_id: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
})

export const createExpenseSchema = expenseBaseSchema
  .refine(
    (data) => data.document_type !== 'NO_DOCUMENT' || (data.note && data.note.length > 0),
    { message: 'Бележка е задължителна при липса на документ', path: ['note'] }
  )
  .refine(
    (data) => (data.document_type !== 'INVOICE' && data.document_type !== 'CREDIT_NOTE') || !!(data.document_number && data.document_number.trim().length > 0),
    { message: 'Номер на документ е задължителен за фактура и кредитно известие', path: ['document_number'] }
  )

export const updateExpenseSchema = expenseBaseSchema.partial()

export const submitExpenseSchema = expenseBaseSchema
  .refine(
    (data) => data.document_type !== 'NO_DOCUMENT' || (data.note && data.note.length > 0),
    { message: 'Бележка е задължителна при липса на документ', path: ['note'] }
  )
  .refine(
    (data) => (data.document_type !== 'INVOICE' && data.document_type !== 'CREDIT_NOTE') || !!(data.document_number && data.document_number.trim().length > 0),
    { message: 'Номер на документ е задължителен за фактура и кредитно известие', path: ['document_number'] }
  )

export const payExpenseSchema = z.object({
  expense_id: z.string().uuid(),
  paid_amount: z.number().positive(),
  paid_at: z.string().date().optional(),
  paid_from_cash: z.string().nullable().optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
  cash_register_id: z.string().uuid().nullable().optional(),
})
