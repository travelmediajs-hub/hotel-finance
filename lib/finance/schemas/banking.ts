import { z } from 'zod'

// ============================================================
// BANK ACCOUNT
// ============================================================
export const createBankAccountSchema = z.object({
  name: z.string().min(1),
  iban: z.string().min(10).max(34),
  bank: z.string().min(1),
  currency: z.enum(['BGN', 'EUR', 'USD']),
  account_type: z.enum(['CURRENT', 'SAVINGS', 'CREDIT', 'DEPOSIT']),
  opening_balance: z.number(),
  opening_balance_date: z.string().date(),
  note: z.string().nullable().optional(),
})

// ============================================================
// BANK TRANSACTION
// ============================================================
export const createBankTransactionSchema = z.object({
  bank_account_id: z.string().uuid(),
  transaction_date: z.string().date(),
  direction: z.enum(['IN', 'OUT']),
  amount: z.number().positive(),
  counterparty: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.enum([
    'IN_HOTEL', 'IN_POS', 'IN_OTHER',
    'OUT_INVOICE', 'OUT_CREDIT', 'OUT_REVOLV', 'OUT_SALARY',
    'OUT_TAX', 'OUT_RENT', 'OUT_TRANSFER',
    'INTER_BANK',
  ]),
  property_id: z.string().uuid().nullable().optional(),
  loan_id: z.string().uuid().nullable().optional(),
  expense_id: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
})

// ============================================================
// LOAN
// ============================================================
export const createLoanSchema = z.object({
  name: z.string().min(1),
  bank: z.string().min(1),
  principal_amount: z.number().positive(),
  disbursed_amount: z.number().min(0).optional(),
  interest_rate: z.number().min(0).max(100),
  monthly_payment: z.number().positive(),
  payment_day: z.number().int().min(1).max(31),
  first_payment_date: z.string().date(),
  last_payment_date: z.string().date(),
  collateral: z.string().nullable().optional(),
  bank_account_id: z.string().uuid(),
})

// ============================================================
// REVOLVING CREDIT
// ============================================================
export const createRevolvingCreditSchema = z.object({
  name: z.string().min(1),
  bank: z.string().min(1),
  credit_limit: z.number().positive(),
  interest_rate: z.number().min(0).max(100),
  commitment_fee: z.number().min(0).nullable().optional(),
  open_date: z.string().date(),
  expiry_date: z.string().date().nullable().optional(),
  bank_account_id: z.string().uuid(),
})

// ============================================================
// CO CASH
// ============================================================
export const createCOCashSchema = z.object({
  name: z.string().min(1),
  opening_balance: z.number(),
  opening_balance_date: z.string().date(),
})
