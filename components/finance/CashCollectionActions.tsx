'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { CashCollectionStatus, UserRole } from '@/types/finance'

interface Props {
  collectionId: string
  status: CashCollectionStatus
  userRole: UserRole
}

export function CashCollectionActions({ collectionId, status, userRole }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canConfirm =
    status === 'SENT' && (userRole === 'MANAGER' || userRole === 'ADMIN_CO')

  if (!canConfirm) return null

  async function handleConfirm() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/cash-collections/${collectionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        <Button disabled={loading} onClick={handleConfirm}>
          {loading ? 'Потвърждаване...' : 'Потвърди получаване'}
        </Button>
      </CardContent>
    </Card>
  )
}
