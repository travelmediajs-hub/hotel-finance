'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DailyReportStatus, UserRole } from '@/types/finance'

interface Props {
  reportId: string
  status: DailyReportStatus
  userRole: UserRole
}

export function DailyReportActions({ reportId, status, userRole }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [showReturn, setShowReturn] = useState(false)

  const baseUrl = `/api/finance/daily-reports/${reportId}`

  async function performAction(action: string, body?: Record<string, unknown>) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка')
        return
      }
      setShowReturn(false)
      setComment('')
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const isCO = userRole === 'ADMIN_CO' || userRole === 'FINANCE_CO'
  const canApprove = isCO && status === 'SUBMITTED'
  const canReturn = isCO && status === 'SUBMITTED'

  if (!canApprove && !canReturn) return null

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {canApprove && (
            <Button disabled={loading} onClick={() => performAction('approve')}>
              {loading ? 'Одобряване...' : 'Одобри'}
            </Button>
          )}

          {canReturn && (
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => setShowReturn(!showReturn)}
            >
              Върни
            </Button>
          )}
        </div>

        {showReturn && (
          <div className="space-y-3 border rounded-lg p-4">
            <Label htmlFor="return_comment">Коментар (задължителен при връщане)</Label>
            <Textarea
              id="return_comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Причина за връщане..."
              rows={3}
            />
            <Button
              variant="destructive"
              disabled={loading || comment.trim().length === 0}
              onClick={() => performAction('return', { comment: comment.trim() })}
            >
              {loading ? 'Връщане...' : 'Потвърди връщане'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
