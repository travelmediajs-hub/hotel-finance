'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Item = { supplier_id: string | null; supplier: string; total: number; count: number }

const fmt = (n: number) =>
  new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)

export function UnpaidSuppliersList({ items, total, invoiceCount, propertyId }: { items: Item[]; total: number; invoiceCount: number; propertyId?: string }) {
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
              {items.map((u) => {
                const isCredit = u.total < 0
                return (
                  <TableRow key={u.supplier_id ?? u.supplier}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {u.supplier_id ? (
                          <Link
                            href={`/finance/expenses?supplier_id=${u.supplier_id}&status=UNPAID,PARTIAL${propertyId ? `&property_id=${propertyId}` : ''}`}
                            className="hover:underline hover:text-primary transition-colors"
                          >
                            {u.supplier}
                          </Link>
                        ) : (
                          u.supplier
                        )}
                        {isCredit && (
                          <Badge className="text-[0.65rem] px-1 py-0 bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/15">
                            КИ
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{u.count}</TableCell>
                    <TableCell className={`text-right font-semibold ${isCredit ? 'text-amber-500' : 'text-rose-500'}`}>{fmt(u.total)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
