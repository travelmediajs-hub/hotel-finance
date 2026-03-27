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
  propertyId: string
  trigger: React.ReactNode
}

export function TerminalForm({ propertyId, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const tid = (formData.get('tid') as string)?.trim()
    const bank = (formData.get('bank') as string)?.trim()
    const location = (formData.get('location') as string)?.trim()

    try {
      const res = await fetch('/api/finance/pos-terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, tid, bank, location }),
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
          <DialogTitle>Нов ПОС терминал</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="terminal-tid">TID *</Label>
            <Input
              id="terminal-tid"
              name="tid"
              required
              placeholder="напр. 12345678"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terminal-bank">Банка *</Label>
            <Input
              id="terminal-bank"
              name="bank"
              required
              placeholder="напр. УниКредит"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terminal-location">Локация *</Label>
            <Input
              id="terminal-location"
              name="location"
              required
              placeholder="напр. Рецепция"
            />
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
