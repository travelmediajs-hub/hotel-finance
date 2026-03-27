import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/finance/auth'
import { PropertyList } from '@/components/finance/PropertyList'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
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
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            <Plus className="h-4 w-4 mr-2" />
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
