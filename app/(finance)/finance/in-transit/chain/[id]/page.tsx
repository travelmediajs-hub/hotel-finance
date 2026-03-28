'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ChainStatus, ChainModuleType } from '@/types/finance'

const statusLabels: Record<ChainStatus, string> = {
  OPEN: 'Отворена',
  CLOSED: 'Затворена',
}

const statusClasses: Record<ChainStatus, string> = {
  OPEN: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  CLOSED: 'bg-green-500/15 text-green-500 border-green-500/30',
}

const moduleTypeLabels: Record<ChainModuleType, string> = {
  BankTransaction: 'Банкова транзакция',
  Withdrawal: 'Теглене',
  Expense: 'Разход',
  CashCollection: 'Събиране',
  MoneyReceived: 'Получени пари',
  IncomeEntry: 'Приход',
}

interface ChainStep {
  id: string
  step_order: number
  module_type: ChainModuleType
  module_id: string
  description: string | null
}

interface ChainDetail {
  id: string
  name: string
  chain_date: string
  description: string | null
  status: ChainStatus
  in_transit_id: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  transaction_chain_steps: ChainStep[]
}

export default function ChainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [chain, setChain] = useState<ChainDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/finance/transaction-chains/${id}`)
      if (res.status === 404) { setNotFound(true); return }
      if (!res.ok) { setNotFound(true); return }
      const data = await res.json()
      setChain(data)
    }
    load()
  }, [id])

  async function handleClose() {
    setCloseError(null)
    setClosing(true)
    try {
      const res = await fetch(`/api/finance/transaction-chains/${id}/close`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        setCloseError(data.message ?? data.error ?? 'Грешка при затваряне')
        return
      }
      router.refresh()
      const updated = await fetch(`/api/finance/transaction-chains/${id}`)
      if (updated.ok) setChain(await updated.json())
    } catch {
      setCloseError('Грешка при връзка със сървъра')
    } finally {
      setClosing(false)
    }
  }

  if (notFound) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Верижката не е намерена.</p>
      </div>
    )
  }

  if (!chain) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Зареждане...</p>
      </div>
    )
  }

  const steps = [...chain.transaction_chain_steps].sort((a, b) => a.step_order - b.step_order)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Заглавие */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">{chain.name}</CardTitle>
          <Badge variant="outline" className={statusClasses[chain.status]}>
            {statusLabels[chain.status]}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Дата</div>
              <div>{chain.chain_date}</div>
            </div>
            {chain.in_transit_id && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Обръщение ID</div>
                <div className="font-mono text-xs">{chain.in_transit_id}</div>
              </div>
            )}
            {chain.closed_at && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Затворена на</div>
                <div>{new Date(chain.closed_at).toLocaleString('bg-BG')}</div>
              </div>
            )}
            {chain.description && (
              <div className="space-y-1 md:col-span-2">
                <div className="text-muted-foreground">Описание</div>
                <div>{chain.description}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Стъпки */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Стъпки</CardTitle>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Няма стъпки</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>ID на запис</TableHead>
                  <TableHead>Описание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map(step => (
                  <TableRow key={step.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {step.step_order}
                    </TableCell>
                    <TableCell>{moduleTypeLabels[step.module_type]}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {step.module_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {step.description ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Метаданни */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Създадена на: {new Date(chain.created_at).toLocaleString('bg-BG')}</div>
            <div>Последна промяна: {new Date(chain.updated_at).toLocaleString('bg-BG')}</div>
          </div>
        </CardContent>
      </Card>

      {/* Затваряне */}
      {chain.status === 'OPEN' && (
        <div className="flex flex-col gap-2">
          {closeError && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {closeError}
            </p>
          )}
          <div>
            <Button
              variant="default"
              disabled={closing}
              onClick={handleClose}
            >
              {closing ? 'Затваряне...' : 'Затвори верига'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
