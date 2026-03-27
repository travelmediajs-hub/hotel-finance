'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { DailyReportStatus } from '@/types/finance'

const statusLabels: Record<DailyReportStatus, string> = {
  DRAFT: 'Чернова',
  SUBMITTED: 'Изпратен',
  CONFIRMED: 'Потвърден',
  RETURNED: 'Върнат',
  SENT_TO_CO: 'Изпратен към ЦО',
  APPROVED: 'Одобрен',
  CORRECTED: 'Коригиран',
}

const statusVariants: Record<DailyReportStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  CONFIRMED: 'default',
  RETURNED: 'destructive',
  SENT_TO_CO: 'default',
  APPROVED: 'outline',
  CORRECTED: 'outline',
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function diffColor(v: number): string {
  return v !== 0 ? 'text-red-500' : 'text-muted-foreground'
}

interface Props {
  report: any
}

export function DailyReportView({ report }: Props) {
  const departmentName = report.departments?.name ?? '—'
  const propertyName = report.properties?.name ?? '—'
  const zReport = Array.isArray(report.z_reports) ? report.z_reports[0] : report.z_reports
  const posEntries: any[] = report.pos_entries ?? []
  const lines: any[] = report.daily_report_lines ?? []

  const createdAt = new Date(report.created_at).toLocaleString('bg-BG', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">
            Отчет — {departmentName} — {report.date}
          </CardTitle>
          <Badge variant={statusVariants[report.status as DailyReportStatus]}>
            {statusLabels[report.status as DailyReportStatus]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Обект: </span>
            {propertyName}
          </div>
          <div>
            <span className="text-muted-foreground">Създаден: </span>
            {createdAt}
          </div>
          {report.manager_comment && (
            <div>
              <span className="text-muted-foreground">Коментар от управител: </span>
              {report.manager_comment}
            </div>
          )}
          {report.co_comment && (
            <div>
              <span className="text-muted-foreground">Коментар от ЦО: </span>
              {report.co_comment}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Б. Приходи в брой */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Б. Приходи в брой</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-sm">
            <div className="font-medium">Отдел</div>
            <div className="font-medium text-right">Приход</div>
            <div className="font-medium text-right">Сторно</div>
            <div className="font-medium text-right">Нето</div>

            {lines.map((line: any) => (
              <div key={line.id} className="contents">
                <div className="flex items-center">
                  {line.departments?.name ?? line.department_id}
                </div>
                <div className="flex items-center justify-end font-mono">
                  {fmt(line.cash_income)}
                </div>
                <div className="flex items-center justify-end font-mono">
                  {fmt(line.cash_return)}
                </div>
                <div className="flex items-center justify-end font-mono">
                  {fmt(line.cash_net)}
                </div>
              </div>
            ))}

            <Separator className="col-span-4 my-1" />

            <div className="font-medium">Общо каса</div>
            <div />
            <div />
            <div className="flex items-center justify-end font-medium font-mono">
              {fmt(report.total_cash_net)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* В. Приходи по POS */}
      {posEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">В. Приходи по POS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-sm">
              <div className="font-medium">Терминал</div>
              <div className="font-medium text-right">Сума</div>
              <div className="font-medium text-right">Сторно</div>
              <div className="font-medium text-right">Нето</div>

              {posEntries.map((entry: any) => (
                <div key={entry.id} className="contents">
                  <div className="flex items-center">
                    {entry.pos_terminals?.tid ?? entry.pos_terminal_id}
                  </div>
                  <div className="flex items-center justify-end font-mono">
                    {fmt(entry.amount)}
                  </div>
                  <div className="flex items-center justify-end font-mono">
                    {fmt(entry.return_amount)}
                  </div>
                  <div className="flex items-center justify-end font-mono">
                    {fmt(entry.net_amount)}
                  </div>
                </div>
              ))}

              <Separator className="col-span-4 my-1" />

              <div className="font-medium">Общо POS</div>
              <div />
              <div />
              <div className="flex items-center justify-end font-medium font-mono">
                {fmt(report.total_pos_net)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Г. Z-отчет */}
      {zReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Г. Z-отчет</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">Каса</div>
                <div className="font-mono">{fmt(zReport.cash_amount)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">POS</div>
                <div className="font-mono">{fmt(zReport.pos_amount)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Общо</div>
                <div className="font-mono font-medium">{fmt(zReport.total_amount)}</div>
              </div>
            </div>
            {zReport.attachment_url && (
              <div className="mt-4">
                <a
                  href={zReport.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Прикачен Z-отчет
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Д. Разлики */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Д. Разлики</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Разлика каса</div>
              <div className={`text-lg font-medium font-mono ${diffColor(report.cash_diff)}`}>
                {fmt(report.cash_diff)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Разлика POS</div>
              <div className={`text-lg font-medium font-mono ${diffColor(report.pos_diff)}`}>
                {fmt(report.pos_diff)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Обща разлика</div>
              <div className={`text-lg font-medium font-mono ${diffColor(report.total_diff)}`}>
                {fmt(report.total_diff)}
              </div>
            </div>
          </div>
          {report.diff_explanation && (
            <div className="mt-4 text-sm">
              <span className="text-muted-foreground">Обяснение: </span>
              {report.diff_explanation}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
