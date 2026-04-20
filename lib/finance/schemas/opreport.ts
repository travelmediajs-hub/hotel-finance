import { z } from 'zod'

export const vatModeSchema = z.enum(['net', 'gross'])
export const viewModeSchema = z.enum(['plan', 'actual', 'variance'])

export const budgetCellSchema = z.object({
  property_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  row_key: z.string().min(1).max(64),
  amount: z.number().min(-1e10).max(1e10),
})

export const budgetBatchSchema = z.object({
  cells: z.array(budgetCellSchema).min(1).max(500),
})

export const reportQuerySchema = z.object({
  property_id: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  vat_mode: vatModeSchema.default('net'),
})

export const budgetQuerySchema = z.object({
  property_id: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
})

export const exportQuerySchema = reportQuerySchema.extend({
  view: viewModeSchema.default('variance'),
})

export type BudgetCell = z.infer<typeof budgetCellSchema>
export type BudgetBatch = z.infer<typeof budgetBatchSchema>
export type ReportQuery = z.infer<typeof reportQuerySchema>
export type BudgetQuery = z.infer<typeof budgetQuerySchema>
export type ExportQuery = z.infer<typeof exportQuerySchema>
