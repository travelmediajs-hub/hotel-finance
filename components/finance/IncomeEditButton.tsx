'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { IncomeForm } from './IncomeForm'

interface InitialEntry {
  id: string
  entry_date: string
  property_id: string
  type: string
  amount: number
  payment_method: string
  payer: string
  account_id: string | null
  bank_account_id: string | null
  loan_id: string | null
  period_from: string | null
  period_to: string | null
  description: string | null
  attachment_url: string | null
}

interface Props {
  entry: InitialEntry
  properties: { id: string; name: string }[]
  bankAccounts: { id: string; name: string; iban: string }[]
  loans: { id: string; name: string }[]
  accounts: Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>
}

export function IncomeEditButton({ entry, properties, bankAccounts, loans, accounts }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Редактирай"
        className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="size-3.5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Редактиране на приход</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <IncomeForm
              properties={properties}
              bankAccounts={bankAccounts}
              loans={loans}
              accounts={accounts}
              entry={entry}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
