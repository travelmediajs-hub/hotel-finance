'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  propertyId: string
}

export function NewReportButton({ propertyId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch('/api/finance/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, date: today }),
      })

      if (res.status === 409) {
        alert('Вече съществува отчет за днес')
        return
      }

      if (!res.ok) {
        const data = await res.json()
        alert(data.message ?? 'Грешка при създаване')
        return
      }

      router.refresh()
    } catch {
      alert('Грешка при връзка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" disabled={loading} onClick={handleCreate}>
      <Plus className="h-3.5 w-3.5 mr-1" />
      {loading ? 'Създаване...' : 'Нов отчет'}
    </Button>
  )
}
