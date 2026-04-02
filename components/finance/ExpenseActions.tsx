'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { ExpenseStatus, UserRole } from '@/types/finance'
import { isCORole } from '@/lib/finance/roles'

interface Props {
  expenseId: string
  status: ExpenseStatus
  userRole: UserRole
  isOwner: boolean
  remainingAmount: number
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function ExpenseActions({ expenseId, status, userRole, isOwner, remainingAmount }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [showReturn, setShowReturn] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [paidAmount, setPaidAmount] = useState(remainingAmount)
  const [paidAt, setPaidAt] = useState(toDateString(new Date()))
  const [paidFromCash, setPaidFromCash] = useState('')

  const baseUrl = `/api/finance/expenses/${expenseId}`

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
        setError(data.message ?? data.error ?? 'Грешка при изпълнение на действието')
        return
      }
      setShowReturn(false)
      setShowReject(false)
      setShowPay(false)
      setComment('')
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = userRole === 'ADMIN_CO'
  const isCO = isCORole(userRole)
  const canSubmit = (isOwner || isAdmin) && status === 'DRAFT'
  const canApprove = isCO && status === 'SENT_TO_CO'
  const canReturn = isCO && status === 'SENT_TO_CO'
  const canReject = isCO && status === 'SENT_TO_CO'
  const canPay = isCO && status === 'APPROVED'

  const hasActions = canSubmit || canApprove || canReturn || canReject || canPay

  if (!hasActions) return null

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {canSubmit && (
            <Button disabled={loading} onClick={() => performAction('submit')}>
              {loading ? 'Изпращане...' : 'Изпрати към ЦО'}
            </Button>
          )}

          {canApprove && (
            <Button disabled={loading} onClick={() => performAction('approve')}>
              {loading ? 'Одобряване...' : 'Одобри'}
            </Button>
          )}

          {canPay && (
            <Button disabled={loading} onClick={() => setShowPay(true)}>
              Плати
            </Button>
          )}

          {canReturn && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setShowReturn(!showReturn)}
            >
              Върни
            </Button>
          )}

          {canReject && (
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => setShowReject(!showReject)}
            >
              Отхвърли
            </Button>
          )}
        </div>

        {/* Return dialog inline */}
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
              variant="outline"
              disabled={loading || comment.trim().length === 0}
              onClick={() => performAction('return', { comment: comment.trim() })}
            >
              {loading ? 'Връщане...' : 'Потвърди връщане'}
            </Button>
          </div>
        )}

        {/* Reject dialog inline */}
        {showReject && (
          <div className="space-y-3 border rounded-lg p-4">
            <Label htmlFor="reject_comment">Коментар (задължителен при отхвърляне)</Label>
            <Textarea
              id="reject_comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Причина за отхвърляне..."
              rows={3}
            />
            <Button
              variant="destructive"
              disabled={loading || comment.trim().length === 0}
              onClick={() => performAction('reject', { comment: comment.trim() })}
            >
              {loading ? 'Отхвърляне...' : 'Потвърди отхвърляне'}
            </Button>
          </div>
        )}

        {/* Pay dialog */}
        <Dialog open={showPay} onOpenChange={setShowPay}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Потвърди плащане</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paid_amount">Платена сума</Label>
                <Input
                  id="paid_amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid_at">Дата на плащане</Label>
                <DateInput
                  id="paid_at"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid_from_cash">От каса (незадължително)</Label>
                <Input
                  id="paid_from_cash"
                  value={paidFromCash}
                  onChange={(e) => setPaidFromCash(e.target.value)}
                  placeholder="Име на каса"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={loading || paidAmount <= 0}
                onClick={() => performAction('pay', {
                  paid_amount: paidAmount,
                  paid_at: paidAt,
                  paid_from_cash: paidFromCash || null,
                })}
              >
                {loading ? 'Плащане...' : 'Потвърди плащане'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
