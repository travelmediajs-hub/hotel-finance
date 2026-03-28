'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { DailyReportStatus } from '@/types/finance'

const reportStatusLabels: Record<DailyReportStatus, string> = {
  DRAFT: 'Чернова',
  SUBMITTED: 'Изпратен',
  CONFIRMED: 'Потвърден',
  RETURNED: 'Върнат',
  SENT_TO_CO: 'Изпратен към ЦО',
  APPROVED: 'Одобрен',
  CORRECTED: 'Коригиран',
}

const reportStatusVariants: Record<DailyReportStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
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

interface Props {
  propertyId: string
  propertyName: string
  date: string
}

export function ConsolidationNewForm({ propertyId, propertyName, date: initialDate }: Props) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [reports, setReports] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setLoadingReports(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/finance/daily-reports?property_id=${propertyId}&date=${date}`
      )
      if (!res.ok) {
        setError('Грешка при зареждане на отчетите')
        setReports([])
        return
      }
      const data = await res.json()
      setReports(data)
    } catch {
      setError('Грешка при връзка със сървъра')
      setReports([])
    } finally {
      setLoadingReports(false)
    }
  }, [propertyId, date])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const allConfirmed =
    reports.length > 0 &&
    reports.every((r: any) => r.status === 'CONFIRMED')

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/finance/consolidations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, date }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при създаване на консолидация')
        return
      }
      const consolidation = await res.json()
      router.push(`/finance/consolidations/${consolidation.id}`)
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Нова консолидация — {propertyName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="consolidation_date">Дата</Label>
            <Input
              id="consolidation_date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Дневни отчети за {date}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded mb-4">
              {error}
            </p>
          )}

          {loadingReports ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Зареждане...
            </p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Няма дневни отчети за тази дата
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Отдел</TableHead>
                  <TableHead className="text-right">Каса нето</TableHead>
                  <TableHead className="text-right">POS нето</TableHead>
                  <TableHead className="text-right">Разлика</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report: any) => (
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

          <div className="mt-6">
            {!allConfirmed && reports.length > 0 && (
              <p className="text-sm text-muted-foreground mb-3">
                Всички отдели трябва да имат потвърдени отчети, за да изпратите консолидацията.
              </p>
            )}
            <Button
              disabled={!allConfirmed || sending}
              onClick={handleSend}
            >
              {sending ? 'Изпращане...' : 'Изпрати към ЦО'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
