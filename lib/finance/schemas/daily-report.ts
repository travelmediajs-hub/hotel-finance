import { z } from 'zod'

const nonNegativeDecimal = z.number().min(0)

// ============================================================
// DAILY REPORT LINE (one per department)
// ============================================================
export const dailyReportLineSchema = z.object({
  department_id: z.string().uuid(),
  cash_income: nonNegativeDecimal,
  cash_refund: nonNegativeDecimal,
  pos_income: nonNegativeDecimal,
  pos_refund: nonNegativeDecimal,
  z_cash: nonNegativeDecimal,
  z_pos: nonNegativeDecimal,
  z_attachment_url: z.string().nullable().optional(),
  pos_report_amount: nonNegativeDecimal,
})

// ============================================================
// CREATE DAILY REPORT (property + date)
// ============================================================
export const createDailyReportSchema = z.object({
  property_id: z.string().uuid(),
  date: z.string().date(),
})

// ============================================================
// UPDATE A SINGLE LINE (PATCH)
// ============================================================
export const updateLineSchema = z.object({
  department_id: z.string().uuid(),
  cash_income: nonNegativeDecimal.optional(),
  cash_refund: nonNegativeDecimal.optional(),
  pos_income: nonNegativeDecimal.optional(),
  pos_refund: nonNegativeDecimal.optional(),
  z_cash: nonNegativeDecimal.optional(),
  z_pos: nonNegativeDecimal.optional(),
  z_attachment_url: z.string().nullable().optional(),
  pos_report_amount: nonNegativeDecimal.optional(),
})

// ============================================================
// SUBMIT REPORT
// ============================================================
export const submitDailyReportSchema = z.object({
  general_attachment_url: z.string().nullable().optional(),
  diff_explanation: z.string().nullable().optional(),
})

// ============================================================
// CO ACTIONS
// ============================================================
export const approveDailyReportSchema = z.object({
  co_comment: z.string().nullable().optional(),
})

export const returnDailyReportSchema = z.object({
  comment: z.string().min(1, 'Коментарът е задължителен при връщане'),
})
