import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { computeOperationalReport } from '@/lib/finance/opreport/compute'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ property_id?: string; year?: string; vat_mode?: string }>
}

export default async function OpReportPrintPage({ searchParams }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/login')
  if (!(await hasPermission(user, 'opreport.view'))) redirect('/finance')

  const sp = await searchParams
  const propertyId = sp.property_id ?? ''
  const year = parseInt(sp.year ?? String(new Date().getFullYear()), 10)
  const vatMode = (sp.vat_mode === 'gross' ? 'gross' : 'net') as 'net' | 'gross'

  const allowed = await getUserPropertyIds(user)
  if (allowed && !allowed.includes(propertyId)) redirect('/finance')

  const supabase = await createClient()
  const { data: property } = await supabase
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .single()

  const matrix = await computeOperationalReport(propertyId, year, vatMode)
  const months = matrix.operating_months.slice().sort((a, b) => a - b)
  const LABELS = ['','Яну','Фев','Мар','Апр','Май','Юни','Юли','Авг','Сеп','Окт','Ное','Дек']

  const fmt = (v: number | null, f: 'NUMBER'|'PERCENT'|'CURRENCY') => {
    if (v === null) return ''
    if (f === 'PERCENT') return `${v.toFixed(1)}%`
    return v.toLocaleString('bg-BG', { maximumFractionDigits: 2 })
  }

  return (
    <div className="p-6 print:p-3 text-[11px] print:text-[9px]">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d4d4d4; padding: 2px 4px; }
        th { background: #f4f4f4; text-align: right; }
        th:first-child, td:first-child { text-align: left; }
      `}</style>

      <h1 className="text-base font-semibold mb-2">
        {property?.name} — Операционен P&L {year} ({vatMode === 'gross' ? 'С ДДС' : 'Без ДДС'})
      </h1>

      <table>
        <thead>
          <tr>
            <th>Ред</th>
            {months.map(m => <th key={m}>{LABELS[m]}</th>)}
            <th>YTD</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map(row => (
            <tr key={row.row_key}>
              <td style={{ paddingLeft: `${4 + row.indent_level * 8}px` }}>{row.label_bg}</td>
              {months.map(m => (
                <td key={m} style={{ textAlign: 'right' }}>
                  {fmt(row.cells[m].actual, row.display_format)}
                </td>
              ))}
              <td style={{ textAlign: 'right' }}>{fmt(row.ytd.actual, row.display_format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
