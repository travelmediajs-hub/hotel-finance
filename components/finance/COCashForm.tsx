'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

interface Props {
  trigger: React.ReactNode
}

export function COCashForm({ trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const body = {
      name: (formData.get('name') as string)?.trim(),
      opening_balance: parseFloat(formData.get('opening_balance') as string),
      opening_balance_date: (formData.get('opening_balance_date') as string)?.trim(),
    }

    try {
      const res = await fetch('/api/finance/co-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      setOpen(false)
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement}></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Нова каса ЦО</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="co-name">Име *</Label>
            <Input id="co-name" name="name" required placeholder="напр. Основна каса ЦО" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-balance">Начално салдо *</Label>
            <Input id="co-balance" name="opening_balance" type="number" step="0.01" required defaultValue="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-date">Дата на начално салдо *</Label>
            <Input id="co-date" name="opening_balance_date" type="date" required />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отказ
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Запис...' : 'Създай'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
