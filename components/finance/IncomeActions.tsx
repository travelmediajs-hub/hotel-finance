'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { IncomeEntryStatus, IncomeEntryType, UserRole } from '@/types/finance'
import { isCORole } from '@/lib/finance/roles'

interface Props {
  entryId: string
  status: IncomeEntryStatus
  type: IncomeEntryType
  userRole: UserRole
}

export function IncomeActions({ entryId, status, type, userRole }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCO = isCORole(userRole)
  const canConfirm = isCO && status === 'ENTERED'
  const canRealize = isCO && status === 'ADVANCE' && type === 'INC_ADV'

  const hasActions = canConfirm || canRealize

  if (!hasActions) return null

  async function performAction(action: 'confirm' | 'realize') {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/income/${entryId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при изпълнение на действието')
        return
      }
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {canConfirm && (
            <Button disabled={loading} onClick={() => performAction('confirm')}>
              {loading ? 'Потвърждаване...' : 'Потвърди'}
            </Button>
          )}

          {canRealize && (
            <Button disabled={loading} onClick={() => performAction('realize')}>
              {loading ? 'Реализиране...' : 'Реализирай аванс'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
