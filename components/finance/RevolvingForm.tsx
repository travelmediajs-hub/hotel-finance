'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { BankAccount, RevolvingCredit } from '@/types/finance'

interface Props {
  accounts: BankAccount[]
  trigger: React.ReactNode
  editRevolving?: RevolvingCredit | null
  onClose?: () => void
}

export function RevolvingForm({ accounts, trigger, editRevolving, onClose }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bankAccountId, setBankAccountId] = useState(editRevolving?.bank_account_id ?? '')

  const isEdit = !!editRevolving

  useEffect(() => {
    if (editRevolving) {
      setBankAccountId(editRevolving.bank_account_id)
      setOpen(true)
    }
  }, [editRevolving])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setError(null)
      onClose?.()
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!bankAccountId) {
      setError('Моля, изберете банкова сметка')
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)
    const body = {
      name: (formData.get('name') as string)?.trim(),
      bank: (formData.get('bank') as string)?.trim(),
      credit_limit: parseFloat(formData.get('credit_limit') as string),
      interest_rate: parseFloat(formData.get('interest_rate') as string),
      commitment_fee: (formData.get('commitment_fee') as string)?.trim()
        ? parseFloat(formData.get('commitment_fee') as string)
        : null,
      open_date: (formData.get('open_date') as string)?.trim(),
      expiry_date: (formData.get('expiry_date') as string)?.trim() || null,
      bank_account_id: bankAccountId,
    }

    try {
      const url = isEdit ? `/api/finance/revolving-credits/${editRevolving.id}` : '/api/finance/revolving-credits'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      handleOpenChange(false)
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isEdit && <DialogTrigger render={trigger as React.ReactElement}></DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактирай revolving кредит' : 'Нов revolving кредит'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rev-name">Име *</Label>
              <Input id="rev-name" name="name" required placeholder="напр. Revolving линия" defaultValue={editRevolving?.name ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-bank">Банка *</Label>
              <Input id="rev-bank" name="bank" required placeholder="напр. УниКредит" defaultValue={editRevolving?.bank ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-limit">Лимит *</Label>
              <Input id="rev-limit" name="credit_limit" type="number" step="0.01" min="0.01" required defaultValue={editRevolving?.credit_limit ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-rate">Лихва % *</Label>
              <Input id="rev-rate" name="interest_rate" type="number" step="0.01" min="0" required defaultValue={editRevolving?.interest_rate ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-fee">Такса ангажимент</Label>
              <Input id="rev-fee" name="commitment_fee" type="number" step="0.01" defaultValue={editRevolving?.commitment_fee ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-open">Дата на откриване *</Label>
              <DateInput id="rev-open" name="open_date" required defaultValue={editRevolving?.open_date ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rev-expiry">Дата на изтичане</Label>
              <DateInput id="rev-expiry" name="expiry_date" defaultValue={editRevolving?.expiry_date ?? ''} />
            </div>
            <div className="space-y-2">
              <Label>Банкова сметка *</Label>
              <Select value={bankAccountId} onValueChange={(v) => v && setBankAccountId(v)}>
                <SelectTrigger><SelectValue placeholder="Избери сметка" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.iban})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Отказ
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Запис...' : isEdit ? 'Запази' : 'Създай'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
