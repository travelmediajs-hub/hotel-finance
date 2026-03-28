'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailyReportStatus } from '@/types/finance'

const statusLabels: Record<DailyReportStatus, string> = {
  DRAFT: 'Чернова',
  SUBMITTED: 'Изпратен',
  APPROVED: 'Одобрен',
  RETURNED: 'Върнат',
}

const statusVariants: Record<DailyReportStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  APPROVED: 'outline',
  RETURNED: 'destructive',
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function diffColor(v: number): string {
  return v !== 0 ? 'text-red-500' : 'text-green-500'
}

interface Props {
  report: any
}

export function DailyReportView({ report }: Props) {
  const propertyName = report.properties?.name ?? '—'
  const lines: any[] = report.daily_report_lines ?? []

  const createdAt = new Date(report.created_at).toLocaleString('bg-BG', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">
            Дневен отчет — {propertyName} — {report.date}
          </CardTitle>
          <Badge variant={statusVariants[report.status as DailyReportStatus]}>
            {statusLabels[report.status as DailyReportStatus]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Обект: </span>{propertyName}
          </div>
          <div>
            <span className="text-muted-foreground">Създаден: </span>{createdAt}
          </div>
          {report.co_comment && (
            <div>
              <span className="text-muted-foreground">Коментар от ЦО: </span>
              {report.co_comment}
            </div>
          )}
          {report.general_attachment_url && (
            <div>
              <a
                href={report.general_attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Общ прикачен файл
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-900/50">
                <th className="text-left px-3 py-2 font-medium">Отдел</th>
                <th className="text-center px-1 py-2 font-medium" colSpan={3}>Каса</th>
                <th className="text-center px-1 py-2 font-medium border-l border-zinc-800" colSpan={3}>ПОС</th>
                <th className="text-center px-1 py-2 font-medium border-l border-zinc-800" colSpan={2}>Z-отчет</th>
                <th className="text-center px-1 py-2 font-medium border-l border-zinc-800">ПОС отч.</th>
                <th className="text-center px-1 py-2 font-medium border-l border-zinc-800" colSpan={3}>Разлики</th>
                <th className="px-1 py-2 font-medium border-l border-zinc-800">Файл</th>
              </tr>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left px-3 py-1" />
                <th className="text-right px-2 py-1">Приход</th>
                <th className="text-right px-2 py-1">Сторно</th>
                <th className="text-right px-2 py-1">Нето</th>
                <th className="text-right px-2 py-1 border-l border-zinc-800">Приход</th>
                <th className="text-right px-2 py-1">Сторно</th>
                <th className="text-right px-2 py-1">Нето</th>
                <th className="text-right px-2 py-1 border-l border-zinc-800">Каса</th>
                <th className="text-right px-2 py-1">ПОС</th>
                <th className="text-right px-2 py-1 border-l border-zinc-800">Банка</th>
                <th className="text-right px-2 py-1 border-l border-zinc-800">Каса</th>
                <th className="text-right px-2 py-1">ПОС</th>
                <th className="text-right px-2 py-1">Общо</th>
                <th className="px-2 py-1 border-l border-zinc-800" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any) => {
                const deptName = line.departments?.name ?? '—'
                const cashDiff = Number(line.cash_diff)
                const posDiff = Number(line.pos_diff)
                const lineDiff = Number(line.total_diff)

                return (
                  <tr key={line.id} className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{deptName}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(line.cash_income)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(line.cash_refund)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-mono font-medium">{fmt(Number(line.cash_net))}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-mono border-l border-zinc-800">{fmt(line.pos_income)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(line.pos_refund)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-mono font-medium">{fmt(Number(line.pos_net))}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-mono border-l border-zinc-800">{fmt(line.z_cash)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(line.z_pos)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-mono border-l border-zinc-800">{fmt(line.pos_report_amount)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-mono border-l border-zinc-800 ${diffColor(cashDiff)}`}>{fmt(cashDiff)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-mono ${diffColor(posDiff)}`}>{fmt(posDiff)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-mono font-medium ${diffColor(lineDiff)}`}>{fmt(lineDiff)}</td>
                    <td className="px-2 py-2 border-l border-zinc-800">
                      {line.z_attachment_url && (
                        <a
                          href={line.z_attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs"
                        >
                          Z-файл
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700 font-medium">
                <td className="px-3 py-2">Общо</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s: number, l: any) => s + Number(l.cash_income), 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s: number, l: any) => s + Number(l.cash_refund), 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(report.total_cash_net)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s: number, l: any) => s + Number(l.pos_income), 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s: number, l: any) => s + Number(l.pos_refund), 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(report.total_pos_net)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s: number, l: any) => s + Number(l.z_cash), 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s: number, l: any) => s + Number(l.z_pos), 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s: number, l: any) => s + Number(l.pos_report_amount), 0))}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-mono ${diffColor(report.cash_diff)}`}>{fmt(report.cash_diff)}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-mono ${diffColor(report.pos_diff)}`}>{fmt(report.pos_diff)}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-mono font-bold ${diffColor(report.total_diff)}`}>{fmt(report.total_diff)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Diff explanation */}
      {report.diff_explanation && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <span className="text-muted-foreground">Обяснение за разликата: </span>
            {report.diff_explanation}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
