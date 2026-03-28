import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole, getUserPropertyIds } from '@/lib/finance/auth'
import { ConsolidationNewForm } from '@/components/finance/ConsolidationNewForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ property_id?: string; date?: string }>
}

export default async function NewConsolidationPage({ searchParams }: Props) {
  const user = await requireRole('MANAGER', 'ADMIN_CO')
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const params = await searchParams

  const today = new Date().toISOString().slice(0, 10)
  const date = params.date ?? today

  let propertyId = ''
  let propertyName = ''

  if (user.role === 'ADMIN_CO' || user.isSimulating) {
    if (!params.property_id) {
      // Show property picker
      const { data: properties } = await supabase
        .from('properties')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .order('name')

      return (
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold mb-6">Нова консолидация</h1>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Избери обект</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(properties ?? []).map(p => (
                <Link
                  key={p.id}
                  href={`/finance/consolidations/new?property_id=${p.id}`}
                  className="block px-3 py-2 rounded-md hover:bg-secondary text-sm"
                >
                  {p.name}
                </Link>
              ))}
              {(!properties || properties.length === 0) && (
                <p className="text-muted-foreground text-sm">Няма активни обекти.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    // Fetch the selected property name
    const { data: property } = await supabase
      .from('properties')
      .select('id, name')
      .eq('id', params.property_id)
      .single()

    if (!property) {
      return (
        <div className="p-6 max-w-4xl mx-auto">
          <p className="text-muted-foreground text-sm">Обектът не е намерен.</p>
        </div>
      )
    }

    propertyId = property.id
    propertyName = property.name
  } else {
    const propertyIds = await getUserPropertyIds(user)
    if (!propertyIds || propertyIds.length === 0) {
      return (
        <div className="p-6 max-w-4xl mx-auto">
          <p className="text-muted-foreground text-sm">
            Нямате присвоен обект. Свържете се с администратор.
          </p>
        </div>
      )
    }

    propertyId = propertyIds[0]

    // Fetch property name separately
    const { data: property } = await supabase
      .from('properties')
      .select('name')
      .eq('id', propertyId)
      .single()

    propertyName = property?.name ?? '—'
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Нова консолидация</h1>
      <ConsolidationNewForm
        propertyId={propertyId}
        propertyName={propertyName}
        date={date}
      />
    </div>
  )
}
