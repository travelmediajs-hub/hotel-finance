import * as XLSX from 'xlsx'
import type { OpReportMatrix, OpReportViewMode } from '@/types/finance'

const MONTH_LABEL_BG = [
  '', 'Януари','Февруари','Март','Април','Май','Юни',
      'Юли','Август','Септември','Октомври','Ноември','Декември',
]

export function buildOpReportXlsx(
  matrix: OpReportMatrix,
  view: OpReportViewMode,
  propertyName: string,
): Buffer {
  const wb = XLSX.utils.book_new()

  const months = matrix.operating_months.slice().sort((a, b) => a - b)

  const title = `${propertyName} — Операционен P&L ${matrix.year} (${matrix.vat_mode === 'gross' ? 'С ДДС' : 'Без ДДС'})`
  const aoa: (string | number | null)[][] = []
  aoa.push([title])

  const colHeader: (string | number | null)[] = ['Ред']
  if (view === 'variance') {
    for (const m of months) {
      colHeader.push(`${MONTH_LABEL_BG[m]} Plan`, `${MONTH_LABEL_BG[m]} Actual`, `${MONTH_LABEL_BG[m]} Δ %`)
    }
    colHeader.push('YTD Plan', 'YTD Actual', 'YTD Δ %')
  } else {
    for (const m of months) colHeader.push(MONTH_LABEL_BG[m])
    colHeader.push('YTD')
  }
  aoa.push(colHeader)

  for (const row of matrix.rows) {
    const label = '  '.repeat(row.indent_level) + row.label_bg
    const line: (string | number | null)[] = [label]
    for (const m of months) {
      const cell = row.cells[m]
      if (view === 'plan')        line.push(cell.plan)
      else if (view === 'actual') line.push(cell.actual)
      else line.push(cell.plan, cell.actual, cell.variance_pct)
    }
    if (view === 'plan')        line.push(row.ytd.plan)
    else if (view === 'actual') line.push(row.ytd.actual)
    else line.push(row.ytd.plan, row.ytd.actual, row.ytd.variance_pct)

    aoa.push(line)
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 38 }, ...Array(colHeader.length - 1).fill({ wch: 14 })]
  XLSX.utils.book_append_sheet(wb, ws, `${matrix.year}`)

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
