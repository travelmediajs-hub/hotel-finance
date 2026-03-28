'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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

      {lines.map((line: any) => {
        const deptName = line.departments?.name ?? line.department_id
        const cashNet = Number(line.cash_net)
        const posNet = Number(line.pos_net)
        const cashDiff = Number(line.cash_diff)
        const posDiff = Number(line.pos_diff)
        const lineDiff = Number(line.total_diff)

        return (
          <Card key={line.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{deptName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Каса приход</div>
                  <div className="font-mono">{fmt(line.cash_income)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Каса сторно</div>
                  <div className="font-mono">{fmt(line.cash_refund)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Каса нето</div>
                  <div className="font-mono font-medium">{fmt(cashNet)}</div>
                </div>
                <div />

                <div className="space-y-1">
                  <div className="text-muted-foreground">ПОС приход</div>
                  <div className="font-mono">{fmt(line.pos_income)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">ПОС сторно</div>
                  <div className="font-mono">{fmt(line.pos_refund)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">ПОС нето</div>
                  <div className="font-mono font-medium">{fmt(posNet)}</div>
                </div>
                <div />
              </div>

              <Separator className="my-3" />

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Z-отчет каса</div>
                  <div className="font-mono">{fmt(line.z_cash)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Z-отчет ПОС</div>
                  <div className="font-mono">{fmt(line.z_pos)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">ПОС отчет (банка)</div>
                  <div className="font-mono">{fmt(line.pos_report_amount)}</div>
                </div>
                {line.z_attachment_url && (
                  <div className="space-y-1">
                    <a
                      href={line.z_attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      Z-отчет файл
                    </a>
                  </div>
                )}
              </div>

              <Separator className="my-3" />

              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Каса разл: </span>
                  <span className={`font-mono ${diffColor(cashDiff)}`}>{fmt(cashDiff)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ПОС разл: </span>
                  <span className={`font-mono ${diffColor(posDiff)}`}>{fmt(posDiff)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Общо: </span>
                  <span className={`font-mono font-medium ${diffColor(lineDiff)}`}>{fmt(lineDiff)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Обобщение</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Общо каса нето</div>
              <div className="text-lg font-medium font-mono">{fmt(report.total_cash_net)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Общо ПОС нето</div>
              <div className="text-lg font-medium font-mono">{fmt(report.total_pos_net)}</div>
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
