'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ConsolidationStatus, DailyReportStatus } from '@/types/finance'

const consolidationStatusLabels: Record<ConsolidationStatus, string> = {
  IN_PROGRESS: 'В процес',
  SENT_TO_CO: 'Изпратен към ЦО',
  APPROVED: 'Одобрен',
  RETURNED: 'Върнат',
  CORRECTED: 'Коригиран',
}

const consolidationStatusVariants: Record<ConsolidationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  IN_PROGRESS: 'secondary',
  SENT_TO_CO: 'default',
  APPROVED: 'outline',
  RETURNED: 'destructive',
  CORRECTED: 'outline',
}

const reportStatusLabels: Record<DailyReportStatus, string> = {
  DRAFT: 'Чернова',
  SUBMITTED: 'Изпратен',
  RETURNED: 'Върнат',
  APPROVED: 'Одобрен',
}

const reportStatusVariants: Record<DailyReportStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  RETURNED: 'destructive',
  APPROVED: 'outline',
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function diffColor(v: number): string {
  return v !== 0 ? 'text-red-500' : 'text-muted-foreground'
}

interface Props {
  consolidation: any
  dailyReports: any[]
}

export function ConsolidationView({ consolidation, dailyReports }: Props) {
  const propertyName = consolidation.properties?.name ?? '—'

  const sentAt = consolidation.sent_at
    ? new Date(consolidation.sent_at).toLocaleString('bg-BG', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : null

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">
            Консолидация — {propertyName} — {consolidation.date}
          </CardTitle>
          <Badge variant={consolidationStatusVariants[consolidation.status as ConsolidationStatus]}>
            {consolidationStatusLabels[consolidation.status as ConsolidationStatus]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {sentAt && (
            <div>
              <span className="text-muted-foreground">Изпратена на: </span>
              {sentAt}
            </div>
          )}
          {consolidation.manager_comment && (
            <div>
              <span className="text-muted-foreground">Коментар от управител: </span>
              {consolidation.manager_comment}
            </div>
          )}
          {consolidation.co_comment && (
            <div>
              <span className="text-muted-foreground">Коментар от ЦО: </span>
              {consolidation.co_comment}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Обобщение</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Каса нето</div>
              <div className="text-lg font-medium font-mono">
                {fmt(consolidation.total_cash_net)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">POS нето</div>
              <div className="text-lg font-medium font-mono">
                {fmt(consolidation.total_pos_net)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Z-отчет</div>
              <div className="text-lg font-medium font-mono">
                {fmt(consolidation.total_z_report)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Разлика</div>
              <div className={`text-lg font-medium font-mono ${diffColor(consolidation.total_diff)}`}>
                {fmt(consolidation.total_diff)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Точки на продажба</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyReports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Няма дневни отчети
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Точка</TableHead>
                  <TableHead className="text-right">Каса нето</TableHead>
                  <TableHead className="text-right">POS нето</TableHead>
                  <TableHead className="text-right">Разлика</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyReports.map((report: any) => (
                  <TableRow key={report.id}>
                    <TableCell className="text-muted-foreground">
                      {report.departments?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {fmt(report.total_cash_net)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {fmt(report.total_pos_net)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${report.total_diff !== 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {fmt(report.total_diff)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={reportStatusVariants[report.status as DailyReportStatus]}>
                        {reportStatusLabels[report.status as DailyReportStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
