'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ChainStatus } from '@/types/finance'

const statusLabels: Record<ChainStatus, string> = {
  OPEN: 'Отворена',
  CLOSED: 'Затворена',
}

const statusClasses: Record<ChainStatus, string> = {
  OPEN: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  CLOSED: 'bg-green-500/15 text-green-500 border-green-500/30',
}

export interface ChainWithStepCount {
  id: string
  name: string
  chain_date: string
  description: string | null
  status: ChainStatus
  step_count?: number
}

interface Props {
  chains: ChainWithStepCount[]
}

export function ChainList({ chains }: Props) {
  const router = useRouter()

  if (chains.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма вериги
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Име</TableHead>
          <TableHead>Описание</TableHead>
          <TableHead className="text-right">Стъпки</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {chains.map(chain => (
          <TableRow
            key={chain.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/finance/in-transit/chain/${chain.id}`)}
          >
            <TableCell className="font-medium">{chain.chain_date}</TableCell>
            <TableCell>{chain.name}</TableCell>
            <TableCell className="text-muted-foreground max-w-xs truncate">
              {chain.description ?? '—'}
            </TableCell>
            <TableCell className="text-right font-mono">
              {chain.step_count ?? 0}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={statusClasses[chain.status]}>
                {statusLabels[chain.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
