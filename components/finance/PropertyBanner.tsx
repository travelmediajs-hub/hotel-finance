'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Property {
  id: string
  name: string
}

interface Props {
  properties: Property[]
  activePropertyId: string | null
  canSwitch: boolean
}

export function PropertyBanner({ properties, activePropertyId, canSwitch }: Props) {
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  const effectiveId = activePropertyId ?? properties[0]?.id ?? ''
  const activeProperty = properties.find((p) => p.id === effectiveId)

  if (!activeProperty) return null

  async function handleChange(propertyId: string) {
    if (!propertyId || propertyId === activePropertyId) return
    setSwitching(true)
    try {
      const res = await fetch('/api/finance/active-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      })
      if (res.ok) router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-primary/10 backdrop-blur">
      <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center gap-3">
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Активен обект
        </span>
        <div className="ml-auto">
          {canSwitch ? (
            <Select
              value={effectiveId}
              onValueChange={(v) => v && handleChange(v)}
              disabled={switching}
            >
              <SelectTrigger className="h-9 text-lg w-[280px] font-bold text-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-sm">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-lg font-bold text-primary tracking-tight">
              {activeProperty.name}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
