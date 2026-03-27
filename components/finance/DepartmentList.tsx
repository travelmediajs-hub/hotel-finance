'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { DepartmentForm } from './DepartmentForm'
import { Plus, Pencil } from 'lucide-react'
import type { Department } from '@/types/finance'

interface Props {
  propertyId: string
  departments: Department[]
}

export function DepartmentList({ propertyId, departments }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Отдели</CardTitle>
        <DepartmentForm
          propertyId={propertyId}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Добави отдел
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Няма добавени отдели.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Име</TableHead>
                <TableHead>Управител (ID)</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map(dept => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {dept.manager_id}
                  </TableCell>
                  <TableCell>
                    <Badge variant={dept.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {dept.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DepartmentForm
                      propertyId={propertyId}
                      department={dept}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
