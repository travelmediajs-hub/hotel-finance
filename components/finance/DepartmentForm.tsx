'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import type { Department } from '@/types/finance'

interface Props {
  propertyId: string
  department?: Department
  trigger: React.ReactNode
}

export function DepartmentForm({ propertyId, department, trigger }: Props) {
  const router = useRouter()
  const isEdit = !!department
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = (formData.get('name') as string)?.trim()
    const managerId = (formData.get('manager_id') as string)?.trim() || null

    const body: Record<string, unknown> = isEdit
      ? { name, manager_id: managerId }
      : { property_id: propertyId, name, manager_id: managerId }

    try {
      const url = isEdit
        ? `/api/finance/departments/${department.id}`
        : '/api/finance/departments'
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
          <DialogTitle>{isEdit ? 'Редактиране на отдел' : 'Нов отдел'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="dept-name">Име *</Label>
            <Input id="dept-name" name="name" required
              defaultValue={department?.name ?? ''} placeholder="напр. Рецепция" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-manager">Управител (ID) *</Label>
            <Input id="dept-manager" name="manager_id" required
              defaultValue={department?.manager_id ?? ''} placeholder="UUID на управител" />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
