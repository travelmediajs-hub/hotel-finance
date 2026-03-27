import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/finance/auth'
import { PropertyList } from '@/components/finance/PropertyList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import type { Property } from '@/types/finance'

export default async function PropertiesPage() {
  const user = await requireRole('ADMIN_CO')
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .order('name')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Обекти</CardTitle>
          <Link
            href="/finance/properties/new"
            className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-[0.8rem] font-medium whitespace-nowrap transition-all outline-none select-none bg-primary text-primary-foreground hover:bg-primary/80 h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Нов обект
          </Link>
        </CardHeader>
        <CardContent>
          <PropertyList properties={(properties as Property[]) ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
