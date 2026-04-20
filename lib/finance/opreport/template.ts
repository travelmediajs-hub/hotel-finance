import { createClient } from '@/lib/supabase/server'
import type { OpReportRow, OpReportRowWithAccounts } from '@/types/finance'

// Load the full operational P&L template (rows + account mappings).
// Ordered by section then sort_order, matching UI display order.
export async function loadOpReportTemplate(): Promise<OpReportRowWithAccounts[]> {
  const supabase = await createClient()

  const { data: rows, error: rowsErr } = await supabase
    .from('opreport_rows')
    .select('*')
    .order('section')
    .order('sort_order')

  if (rowsErr) throw new Error(`Failed to load opreport rows: ${rowsErr.message}`)

  const { data: mappings, error: mapErr } = await supabase
    .from('opreport_row_accounts')
    .select('row_id, account_id')

  if (mapErr) throw new Error(`Failed to load opreport mappings: ${mapErr.message}`)

  const accountsByRow = new Map<string, string[]>()
  for (const m of mappings ?? []) {
    const list = accountsByRow.get(m.row_id) ?? []
    list.push(m.account_id)
    accountsByRow.set(m.row_id, list)
  }

  return (rows as OpReportRow[]).map(r => ({
    ...r,
    account_ids: accountsByRow.get(r.id) ?? [],
  }))
}
