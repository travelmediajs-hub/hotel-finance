import { z } from 'zod'

const nonNegativeDecimal = z.number().min(0)

// ============================================================
// DAILY REPORT LINE (cash income per department)
// ============================================================
export const dailyReportLineSchema = z.object({
  department_id: z.string().uuid(),
  cash_income: nonNegativeDecimal,
  cash_return: nonNegativeDecimal,
})

// ============================================================
// POS ENTRY
// ============================================================
export const posEntrySchema = z.object({
  pos_terminal_id: z.string().uuid(),
  amount: nonNegativeDecimal,
  return_amount: nonNegativeDecimal,
})

// ============================================================
// Z-REPORT
// ============================================================
export const zReportSchema = z.object({
  cash_amount: nonNegativeDecimal,
  pos_amount: nonNegativeDecimal,
  attachment_url: z.string().url(),
  additional_files: z.array(z.string().url()).optional(),
})

// ============================================================
// DAILY REPORT (full form submission)
// ============================================================
export const saveDailyReportSchema = z.object({
  department_id: z.string().uuid(),
  property_id: z.string().uuid(),
  date: z.string().date(),
  lines: z.array(dailyReportLineSchema).min(1),
  pos_entries: z.array(posEntrySchema),
  z_report: zReportSchema,
  diff_explanation: z.string().nullable().optional(),
})

// NOTE: Rule #3 (diff_explanation required when totalDiff != 0) is enforced
// in the API layer after computing totals, not here — the Zod schema does not
// have access to the calculated diff values. The API must call
// validateDiffExplanation() before transitioning to SUBMITTED status.

// ============================================================
// MANAGER ACTIONS
// ============================================================
export const confirmDailyReportSchema = z.object({
  report_id: z.string().uuid(),
  manager_comment: z.string().nullable().optional(),
})

export const returnDailyReportSchema = z.object({
  report_id: z.string().uuid(),
  manager_comment: z.string().min(1, 'Коментарът е задължителен при връщане'),
})

// ============================================================
// CO ACTIONS
// ============================================================
export const approveDailyReportSchema = z.object({
  report_id: z.string().uuid(),
  co_comment: z.string().nullable().optional(),
})

export const returnFromCOSchema = z.object({
  report_id: z.string().uuid(),
  co_comment: z.string().min(1, 'Коментарът е задължителен при връщане'),
})
