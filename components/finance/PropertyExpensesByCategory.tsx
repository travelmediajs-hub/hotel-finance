'use client'

import { Fragment, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ExpEntry = { date: string; supplier: string; total: number; status: string }
type ExpMonth = { ym: string; total: number; entries: ExpEntry[] }
type ExpCategory = { code: string; name: string; total: number; months: ExpMonth[] }

const fmt = (n: number) =>
  new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
}

const statusLabel = (s: string) => {
  switch (s) {
    case 'PAID':
      return 'Платена'
    case 'PARTIALLY_PAID':
      return 'Частично'
    case 'UNPAID':
      return 'Неплатена'
    case 'OVERDUE':
      return 'Просрочена'
    default:
      return s
  }
}

export function PropertyExpensesByCategory({ categories }: { categories: ExpCategory[] }) {
  const [openCat, setOpenCat] = useState<Record<string, boolean>>({})
  const [openMonth, setOpenMonth] = useState<Record<string, boolean>>({})

  const toggleCat = (k: string) => setOpenCat((p) => ({ ...p, [k]: !p[k] }))
  const toggleMonth = (k: string) => setOpenMonth((p) => ({ ...p, [k]: !p[k] }))

  const grandTotal = categories.reduce((s, c) => s + c.total, 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
          <TableHead>Перо (USALI)</TableHead>
          <TableHead className="text-right">Общо</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((cat) => {
          const ckey = cat.code + '|' + cat.name
          const isOpen = !!openCat[ckey]
          const sortedMonths = [...cat.months].sort((a, b) => a.ym.localeCompare(b.ym))
          return (
            <Fragment key={ckey}>
              <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => toggleCat(ckey)}>
                <TableCell className="text-muted-foreground">{isOpen ? '▾' : '▸'}</TableCell>
                <TableCell className="font-medium">
                  <span className="text-muted-foreground mr-2">{cat.code}</span>
                  {cat.name}
                </TableCell>
                <TableCell className="text-right font-semibold">{fmt(cat.total)}</TableCell>
              </TableRow>
              {isOpen &&
                sortedMonths.map((m) => {
                  const mkey = ckey + '|' + m.ym
                  const mOpen = !!openMonth[mkey]
                  const sortedEntries = [...m.entries].sort((a, b) => a.date.localeCompare(b.date))
                  return (
                    <Fragment key={mkey}>
                      <TableRow className="cursor-pointer bg-muted/20 hover:bg-muted/40" onClick={() => toggleMonth(mkey)}>
                        <TableCell></TableCell>
                        <TableCell className="pl-8 text-sm">
                          <span className="text-muted-foreground mr-2">{mOpen ? '▾' : '▸'}</span>
                          {monthLabel(m.ym)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{fmt(m.total)}</TableCell>
                      </TableRow>
                      {mOpen &&
                        sortedEntries.map((e, i) => (
                          <TableRow key={mkey + '|' + i} className="bg-muted/5">
                            <TableCell></TableCell>
                            <TableCell className="pl-16 text-xs text-muted-foreground">
                              <span className="mr-2">{new Date(e.date).toLocaleDateString('bg-BG')}</span>
                              <span className="text-foreground">{e.supplier}</span>
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-muted">{statusLabel(e.status)}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs">{fmt(e.total)}</TableCell>
                          </TableRow>
                        ))}
                    </Fragment>
                  )
                })}
            </Fragment>
          )
        })}
        <TableRow>
          <TableCell></TableCell>
          <TableCell className="font-semibold">Общо</TableCell>
          <TableCell className="text-right font-semibold text-rose-500">{fmt(grandTotal)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
