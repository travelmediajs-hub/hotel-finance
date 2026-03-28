import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole, getUserPropertyIds } from '@/lib/finance/auth'
import { ExpenseForm } from '@/components/finance/ExpenseForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ property_id?: string }>
}

export default async function NewExpensePage({ searchParams }: Props) {
  const user = await requireRole('MANAGER', 'ADMIN_CO')
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const params = await searchParams

  let propertyId = ''

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
          <h1 className="text-lg font-semibold mb-6">Нов разход</h1>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Избери обект</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(properties ?? []).map(p => (
                <Link
                  key={p.id}
                  href={`/finance/expenses/new?property_id=${p.id}`}
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

    propertyId = params.property_id
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
  }

  // Fetch departments and USALI accounts for the property
  const [{ data: departments }, { data: accounts }] = await Promise.all([
    supabase
      .from('departments')
      .select('id, name')
      .eq('property_id', propertyId)
      .eq('status', 'ACTIVE')
      .order('name'),
    supabase
      .from('usali_accounts')
      .select('id, code, name, level, account_type, parent_id')
      .eq('is_active', true)
      .eq('account_type', 'EXPENSE')
      .order('sort_order'),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Нов разход</h1>
      <ExpenseForm
        propertyId={propertyId}
        departments={(departments ?? []) as { id: string; name: string }[]}
        accounts={(accounts ?? []) as Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>}
      />
    </div>
  )
}
