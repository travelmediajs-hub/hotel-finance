'use client'

import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { DailyReportStatus } from '@/types/finance'

interface DepartmentInfo {
  id: string
  name: string
}

interface ReportLine {
  department_id: string
  cash_income: number
  cash_refund: number
  cash_net: number
  pos_income: number
  pos_refund: number
  pos_net: number
  total_diff: number
  departments: { id: string; name: string }
}

export interface ReportWithLines {
  id: string
  date: string
  status: DailyReportStatus
  total_cash_net: number
  total_pos_net: number
  total_diff: number
  daily_report_lines: ReportLine[]
}

const statusLabels: Record<DailyReportStatus, string> = {
  DRAFT: '▣',
  SUBMITTED: '⏳',
  APPROVED: '✓',
  RETURNED: '↩',
}

const statusColors: Record<DailyReportStatus, string> = {
  DRAFT: 'text-zinc-400',
  SUBMITTED: 'text-yellow-500',
  APPROVED: 'text-green-500',
  RETURNED: 'text-red-500',
}

interface Props {
  reports: ReportWithLines[]
  departments: DepartmentInfo[]
}

function fmt(n: number): string {
  return n === 0 ? '—' : n.toFixed(2)
}

export function DailyReportTable({ reports, departments }: Props) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма дневни отчети за този обект
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-zinc-950 z-10 border-r">Дата</TableHead>
            {departments.map((dept) => (
              <TableHead
                key={dept.id}
                colSpan={4}
                className="text-center border-x text-xs"
              >
                {dept.name}
              </TableHead>
            ))}
            <TableHead className="text-right border-x">Общо</TableHead>
            <TableHead className="text-right border-x">Разлика</TableHead>
            <TableHead className="text-center">Ст.</TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="sticky left-0 bg-zinc-950 z-10 border-r" />
            {departments.map((dept) => (
              <>
                <TableHead key={`${dept.id}-ci`} className="text-right text-xs px-1.5 whitespace-nowrap">Каса</TableHead>
                <TableHead key={`${dept.id}-cr`} className="text-right text-xs px-1.5 whitespace-nowrap">К.Ст</TableHead>
                <TableHead key={`${dept.id}-pi`} className="text-right text-xs px-1.5 whitespace-nowrap">ПОС</TableHead>
                <TableHead key={`${dept.id}-pr`} className="text-right text-xs px-1.5 border-r whitespace-nowrap">П.Ст</TableHead>
              </>
            ))}
            <TableHead className="border-x" />
            <TableHead className="border-x" />
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => {
            const linesByDept = new Map(
              report.daily_report_lines.map((l) => [l.department_id, l])
            )
            const grandTotal = report.total_cash_net + report.total_pos_net

            return (
              <TableRow key={report.id}>
                <TableCell className="sticky left-0 bg-zinc-950 z-10 border-r whitespace-nowrap">
                  <Link
                    href={`/finance/daily-reports/${report.id}`}
                    className="text-foreground hover:underline font-medium"
                  >
                    {report.date}
                  </Link>
                </TableCell>
                {departments.map((dept) => {
                  const line = linesByDept.get(dept.id)
                  return (
                    <>
                      <TableCell key={`${report.id}-${dept.id}-ci`} className="text-right text-sm tabular-nums px-1.5">
                        {fmt(line?.cash_income ?? 0)}
                      </TableCell>
                      <TableCell key={`${report.id}-${dept.id}-cr`} className="text-right text-sm tabular-nums px-1.5">
                        {fmt(line?.cash_refund ?? 0)}
                      </TableCell>
                      <TableCell key={`${report.id}-${dept.id}-pi`} className="text-right text-sm tabular-nums px-1.5">
                        {fmt(line?.pos_income ?? 0)}
                      </TableCell>
                      <TableCell key={`${report.id}-${dept.id}-pr`} className="text-right text-sm tabular-nums px-1.5 border-r">
                        {fmt(line?.pos_refund ?? 0)}
                      </TableCell>
                    </>
                  )
                })}
                <TableCell className="text-right font-medium tabular-nums border-x">
                  {fmt(grandTotal)}
                </TableCell>
                <TableCell className={`text-right tabular-nums border-x ${report.total_diff !== 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {fmt(report.total_diff)}
                </TableCell>
                <TableCell className={`text-center ${statusColors[report.status]}`}>
                  <span title={report.status}>{statusLabels[report.status]}</span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
