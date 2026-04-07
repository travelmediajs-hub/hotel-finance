'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Item = { supplier: string; total: number; count: number }

const fmt = (n: number) =>
  new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)

export function UnpaidSuppliersList({ items, total, invoiceCount }: { items: Item[]; total: number; invoiceCount: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-sm hover:bg-muted/40 rounded px-2 py-2 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">{open ? '▾' : '▸'}</span>
          <span className="font-medium">Общо задължения</span>
          <span className="text-xs text-muted-foreground">({invoiceCount} фактури, {items.length} доставчици)</span>
        </span>
        <span className="font-semibold text-rose-500">{fmt(total)}</span>
      </button>

      {open && (
        <div className="mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Доставчик</TableHead>
                <TableHead className="text-right">Брой</TableHead>
                <TableHead className="text-right">Общо</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((u) => (
                <TableRow key={u.supplier}>
                  <TableCell>{u.supplier}</TableCell>
                  <TableCell className="text-right">{u.count}</TableCell>
                  <TableCell className="text-right font-semibold text-rose-500">{fmt(u.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
