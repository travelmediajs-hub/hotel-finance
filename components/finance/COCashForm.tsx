'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

interface Props {
  trigger: React.ReactNode
}

const paymentOptions = [
  { value: 'CASH', label: 'Брой' },
  { value: 'CARD', label: 'Карта' },
  { value: 'OTHER', label: 'Друго' },
]

export function COCashForm({ trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [allowedPayments, setAllowedPayments] = useState<string[]>(['CASH'])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = (formData.get('name') as string)?.trim()
    const openingBalance = parseFloat(formData.get('opening_balance') as string)
    const openingDate = (formData.get('opening_balance_date') as string)?.trim()

    if (!name) { setError('Моля, въведете име'); setLoading(false); return }
    if (isNaN(openingBalance)) { setError('Моля, въведете начално салдо'); setLoading(false); return }
    if (!openingDate) { setError('Моля, въведете дата'); setLoading(false); return }
    if (allowedPayments.length === 0) { setError('Моля, изберете поне един вид плащане'); setLoading(false); return }

    const body = {
      name,
      opening_balance: openingBalance,
      opening_balance_date: openingDate,
      allowed_payments: allowedPayments,
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
            <DateInput id="co-date" name="opening_balance_date" required />
          </div>
          <div className="space-y-2">
            <Label>Видове плащания *</Label>
            <div className="flex flex-wrap gap-4">
              {paymentOptions.map(opt => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowedPayments.includes(opt.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAllowedPayments(prev => [...prev, opt.value])
                      } else {
                        setAllowedPayments(prev => prev.filter(v => v !== opt.value))
                      }
                    }}
                    className="rounded border-border"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
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
