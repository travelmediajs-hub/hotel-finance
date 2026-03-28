import { z } from 'zod'

export const createUsaliAccountSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(200),
  account_type: z.enum(['REVENUE', 'EXPENSE']),
  level: z.number().int().min(1).max(3),
  parent_id: z.string().uuid().nullable(),
  template_id: z.string().uuid(),
  sort_order: z.number().int().default(0),
})

export const updateUsaliAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

export const upsertBudgetSchema = z.object({
  property_id: z.string().uuid(),
  account_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.number().min(0),
})

export const createPropertyStatisticsSchema = z.object({
  property_id: z.string().uuid(),
  date: z.string().date(),
  rooms_available: z.number().int().min(0),
  rooms_sold: z.number().int().min(0),
  guests: z.number().int().min(0),
})
