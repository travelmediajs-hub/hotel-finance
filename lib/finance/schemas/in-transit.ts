import { z } from 'zod'

// ============================================================
// IN-TRANSIT
// ============================================================
const inTransitSourceSchema = z.object({
  source_type: z.enum(['BANK_ACCOUNT', 'PROPERTY_CASH', 'CO_CASH']),
  source_id: z.string().uuid(),
  amount: z.number().positive(),
  withdrawal_id: z.string().uuid().nullable().optional(),
})

export const createInTransitSchema = z.object({
  total_amount: z.number().positive(),
  currency: z.enum(['BGN', 'EUR', 'USD']).optional(),
  description: z.string().min(1),
  sources: z.array(inTransitSourceSchema).min(1),
})

export const closeInTransitStepSchema = z.object({
  in_transit_id: z.string().uuid(),
  amount: z.number().positive(),
  destination_type: z.enum(['BANK_ACCOUNT', 'PROPERTY_CASH', 'CO_CASH']),
  destination_id: z.string().uuid(),
})

// ============================================================
// TRANSACTION CHAIN
// ============================================================
const chainStepSchema = z.object({
  step_order: z.number().int().positive(),
  module_type: z.enum([
    'BankTransaction', 'Withdrawal', 'Expense',
    'CashCollection', 'MoneyReceived', 'IncomeEntry',
  ]),
  module_id: z.string().uuid(),
  description: z.string().nullable().optional(),
})

export const createTransactionChainSchema = z.object({
  name: z.string().min(1),
  chain_date: z.string().date(),
  description: z.string().nullable().optional(),
  in_transit_id: z.string().uuid().nullable().optional(),
  steps: z.array(chainStepSchema).min(1),
})
