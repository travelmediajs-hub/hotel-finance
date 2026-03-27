'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { DailyReport, DailyReportStatus } from '@/types/finance'

export type ReportWithJoins = DailyReport & {
  departments: { name: string }
  properties: { name: string }
}

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

interface Props {
  reports: ReportWithJoins[]
}

export function DailyReportList({ reports }: Props) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма дневни отчети
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Обект</TableHead>
          <TableHead>Отдел</TableHead>
          <TableHead className="text-right">Каса нето</TableHead>
          <TableHead className="text-right">POS нето</TableHead>
          <TableHead className="text-right">Разлика</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map(report => (
          <TableRow key={report.id}>
            <TableCell>
              <Link
                href={`/finance/daily-reports/${report.id}`}
                className="text-foreground hover:underline font-medium"
              >
                {report.date}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {report.properties.name}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {report.departments.name}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {report.total_cash_net.toFixed(2)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {report.total_pos_net.toFixed(2)}
            </TableCell>
            <TableCell className={`text-right ${report.total_diff !== 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {report.total_diff.toFixed(2)}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariants[report.status]}>
                {statusLabels[report.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
