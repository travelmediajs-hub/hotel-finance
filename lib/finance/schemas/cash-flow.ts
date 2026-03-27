import { z } from 'zod'

// ============================================================
// CASH COLLECTION (CO collects from property)
// NOTE: collected_by_id is set server-side from auth.uid()
// ============================================================
export const createCashCollectionSchema = z.object({
  property_id: z.string().uuid(),
  collection_date: z.string().date(),
  amount: z.number().positive(),
  covers_date_from: z.string().date(),
  covers_date_to: z.string().date(),
  note: z.string().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
})

export const confirmCashCollectionSchema = z.object({
  collection_id: z.string().uuid(),
})

// ============================================================
// MONEY RECEIVED (CO sends to property)
// ============================================================
export const createMoneyReceivedSchema = z.object({
  property_id: z.string().uuid(),
  amount: z.number().positive(),
  sent_date: z.string().date(),
  purpose: z.enum(['OPERATIONAL', 'SALARIES', 'CASH_SUPPLY', 'SPECIFIC_GOAL', 'ADVANCE']),
  purpose_description: z.string().nullable().optional(),
  source_type: z.enum(['BANK_ACCOUNT', 'CO_CASH', 'OTHER_PROPERTY', 'OTHER']),
  source_bank_account_id: z.string().uuid().nullable().optional(),
  source_property_id: z.string().uuid().nullable().optional(),
  delivery_method: z.enum(['IN_PERSON', 'COURIER', 'BANK_TRANSFER']),
  delivered_by: z.string().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
}).refine(
  (data) => !['SPECIFIC_GOAL', 'ADVANCE'].includes(data.purpose) ||
    (data.purpose_description && data.purpose_description.length > 0),
  { message: 'Описание е задължително за конкретна цел/аванс', path: ['purpose_description'] }
).refine(
  (data) => data.source_type !== 'BANK_ACCOUNT' || data.source_bank_account_id != null,
  { message: 'Банкова сметка е задължителна при source_type BANK_ACCOUNT', path: ['source_bank_account_id'] }
).refine(
  (data) => data.source_type !== 'OTHER_PROPERTY' || data.source_property_id != null,
  { message: 'Обект е задължителен при source_type OTHER_PROPERTY', path: ['source_property_id'] }
)

export const confirmMoneyReceivedSchema = z.object({
  id: z.string().uuid(),
  received_in_cash: z.string().min(1),
})
