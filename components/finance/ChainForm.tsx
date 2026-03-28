'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { ChainModuleType } from '@/types/finance'

const moduleTypeOptions: { value: ChainModuleType; label: string }[] = [
  { value: 'BankTransaction', label: 'Банкова транзакция' },
  { value: 'Withdrawal', label: 'Теглене' },
  { value: 'Expense', label: 'Разход' },
  { value: 'CashCollection', label: 'Събиране' },
  { value: 'MoneyReceived', label: 'Получени пари' },
  { value: 'IncomeEntry', label: 'Приход' },
]

interface StepRow {
  module_type: ChainModuleType | ''
  module_id: string
  description: string
}

function emptyStep(): StepRow {
  return { module_type: '', module_id: '', description: '' }
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function ChainForm() {
  const router = useRouter()
  const today = toDateString(new Date())

  const [name, setName] = useState('')
  const [chainDate, setChainDate] = useState(today)
  const [description, setDescription] = useState('')
  const [inTransitId, setInTransitId] = useState('')
  const [steps, setSteps] = useState<StepRow[]>([emptyStep()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addStep() {
    setSteps(prev => [...prev, emptyStep()])
  }

  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index))
  }

  function updateStep(index: number, field: keyof StepRow, value: string) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Моля, въведете наименование.')
      return
    }
    if (!chainDate) {
      setError('Моля, въведете дата.')
      return
    }

    const validSteps = steps.filter(s => s.module_type && s.module_id.trim())

    setLoading(true)

    const body = {
      name: name.trim(),
      chain_date: chainDate,
      description: description.trim() || null,
      in_transit_id: inTransitId.trim() || null,
      steps: validSteps.map((s, i) => ({
        step_order: i + 1,
        module_type: s.module_type,
        module_id: s.module_id.trim(),
        description: s.description.trim() || null,
      })),
    }

    try {
      const res = await fetch('/api/finance/transaction-chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      router.push('/finance/in-transit?tab=chains')
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* Основна информация */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Основна информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chain_name">Наименование *</Label>
              <Input
                id="chain_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Наименование на верига"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chain_date">Дата *</Label>
              <Input
                id="chain_date"
                type="date"
                value={chainDate}
                onChange={(e) => setChainDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="chain_description">Описание</Label>
              <Textarea
                id="chain_description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание (незадължително)..."
                rows={3}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="in_transit_id">ID на обръщение (незадълж.)</Label>
              <Input
                id="in_transit_id"
                value={inTransitId}
                onChange={(e) => setInTransitId(e.target.value)}
                placeholder="UUID на обръщение"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Стъпки */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Стъпки</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Добави стъпка
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, index) => (
            <div key={index}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium mt-8">
                  {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Тип модул</Label>
                    <Select
                      value={step.module_type}
                      onValueChange={(v) => v && updateStep(index, 'module_type', v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Избери тип" />
                      </SelectTrigger>
                      <SelectContent>
                        {moduleTypeOptions.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>ID на запис</Label>
                    <Input
                      value={step.module_id}
                      onChange={(e) => updateStep(index, 'module_id', e.target.value)}
                      placeholder="UUID"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <div className="flex gap-2">
                      <Input
                        value={step.description}
                        onChange={(e) => updateStep(index, 'description', e.target.value)}
                        placeholder="Описание (незадълж.)"
                      />
                      {steps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Бутони */}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Запис...' : 'Запази'}
        </Button>
        <Button variant="ghost" type="button" onClick={() => router.back()}>
          Отказ
        </Button>
      </div>
    </form>
  )
}
