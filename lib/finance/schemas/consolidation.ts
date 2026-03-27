import { z } from 'zod'

export const sendConsolidationSchema = z.object({
  property_id: z.string().uuid(),
  date: z.string().date(),
  manager_comment: z.string().nullable().optional(),
})

export const approveConsolidationSchema = z.object({
  consolidation_id: z.string().uuid(),
  co_comment: z.string().nullable().optional(),
})

export const returnConsolidationSchema = z.object({
  consolidation_id: z.string().uuid(),
  co_comment: z.string().min(1, 'Коментарът е задължителен при връщане'),
})
