'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MoneyReceivedStatus, UserRole } from '@/types/finance'

interface Props {
  id: string
  status: MoneyReceivedStatus
  userRole: UserRole
}

export function MoneyReceivedActions({ id, status, userRole }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receivedInCash, setReceivedInCash] = useState('')

  const canConfirm =
    status === 'SENT' && (userRole === 'MANAGER' || userRole === 'ADMIN_CO')

  if (!canConfirm) return null

  async function handleConfirm() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/money-received/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received_in_cash: receivedInCash || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при потвърждаване')
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
        <div className="space-y-2">
          <Label htmlFor="received_in_cash">Получено в брой (незадължително)</Label>
          <Input
            id="received_in_cash"
            value={receivedInCash}
            onChange={(e) => setReceivedInCash(e.target.value)}
            placeholder="Информация за получените пари в брой"
          />
        </div>
        <Button disabled={loading} onClick={handleConfirm}>
          {loading ? 'Потвърждаване...' : 'Потвърди получаването'}
        </Button>
      </CardContent>
    </Card>
  )
}
