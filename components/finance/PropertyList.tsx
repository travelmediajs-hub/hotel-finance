'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { Property } from '@/types/finance'

const typeLabels: Record<string, string> = {
  HOTEL: 'Хотел',
  APARTMENT_HOTEL: 'Апарт хотел',
  HOSTEL: 'Хостел',
  SHOP: 'Магазин',
  OTHER: 'Друг',
}

interface Props {
  properties: Property[]
}

export function PropertyList({ properties }: Props) {
  if (properties.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма добавени обекти.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Име</TableHead>
          <TableHead>Тип</TableHead>
          <TableHead>Град</TableHead>
          <TableHead>ЕИК</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {properties.map(property => (
          <TableRow key={property.id}>
            <TableCell>
              <Link
                href={`/finance/properties/${property.id}`}
                className="text-foreground hover:underline font-medium"
              >
                {property.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {typeLabels[property.type] ?? property.type}
            </TableCell>
            <TableCell className="text-muted-foreground">{property.city}</TableCell>
            <TableCell className="text-muted-foreground font-mono text-xs">
              {property.eik}
            </TableCell>
            <TableCell>
              <Badge variant={property.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {property.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
