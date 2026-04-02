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
import type { WithdrawalPurpose, WithdrawalStatus, UserRole } from '@/types/finance'

interface Props {
  withdrawal: any
  userRole: UserRole
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function WithdrawalActions({ withdrawal, userRole }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showVoid, setShowVoid] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [accountedAmount, setAccountedAmount] = useState(withdrawal.amount as number)
  const [accountedDate, setAccountedDate] = useState(toDateString(new Date()))

  const status = withdrawal.status as WithdrawalStatus
  const purpose = withdrawal.purpose as WithdrawalPurpose
  const isVoid = withdrawal.is_void as boolean
  const isAdvance = purpose === 'ADV_EMP' || purpose === 'ADV_OPS'

  const baseUrl = `/api/finance/withdrawals/${withdrawal.id}`

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
      setShowReject(false)
      setShowAccount(false)
      setShowVoid(false)
      setComment('')
      setVoidReason('')
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  // Determine available actions
  const canApprove =
    (userRole === 'MANAGER' || userRole === 'ADMIN_CO') && status === 'PENDING_APPROVAL'
  const canReject =
    (userRole === 'MANAGER' || userRole === 'ADMIN_CO') && status === 'PENDING_APPROVAL'
  const canAccount =
    userRole === 'ADMIN_CO' &&
    isAdvance &&
    (status === 'RECORDED' || status === 'APPROVED')
  const canVoid =
    userRole === 'ADMIN_CO' && !isVoid

  const hasActions = canApprove || canReject || canAccount || canVoid

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
          {canApprove && (
            <Button disabled={loading} onClick={() => performAction('approve')}>
              {loading ? 'Одобряване...' : 'Одобри'}
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

          {canAccount && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setShowAccount(true)}
            >
              Отчети аванс
            </Button>
          )}

          {canVoid && (
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => setShowVoid(!showVoid)}
            >
              Анулирай
            </Button>
          )}
        </div>

        {/* Reject inline */}
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

        {/* Void inline */}
        {showVoid && (
          <div className="space-y-3 border rounded-lg p-4">
            <Label htmlFor="void_reason">Причина за анулиране (задължителна)</Label>
            <Textarea
              id="void_reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Причина за анулиране..."
              rows={3}
            />
            <Button
              variant="destructive"
              disabled={loading || voidReason.trim().length === 0}
              onClick={() => performAction('void', { void_reason: voidReason.trim() })}
            >
              {loading ? 'Анулиране...' : 'Потвърди анулиране'}
            </Button>
          </div>
        )}

        {/* Account advance dialog */}
        <Dialog open={showAccount} onOpenChange={setShowAccount}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Отчети аванс</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accounted_amount">Отчетена сума</Label>
                <Input
                  id="accounted_amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={accountedAmount || ''}
                  onChange={(e) => setAccountedAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accounted_date">Дата на отчитане</Label>
                <DateInput
                  id="accounted_date"
                  value={accountedDate}
                  onChange={(e) => setAccountedDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={loading || accountedAmount <= 0}
                onClick={() => performAction('account', {
                  accounted_amount: accountedAmount,
                  accounted_date: accountedDate,
                })}
              >
                {loading ? 'Отчитане...' : 'Потвърди отчитане'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
