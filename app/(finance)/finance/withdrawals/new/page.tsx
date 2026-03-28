import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/finance/auth'
import { WithdrawalForm } from '@/components/finance/WithdrawalForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ property_id?: string }>
}

export default async function NewWithdrawalPage({ searchParams }: Props) {
  const user = await requireRole('MANAGER', 'DEPT_HEAD', 'ADMIN_CO')
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const params = await searchParams

  let propertyId = ''

  if (user.role === 'ADMIN_CO') {
    if (!params.property_id) {
      // Show property picker
      const { data: properties } = await supabase
        .from('properties')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .order('name')

      return (
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold mb-6">Ново теглене</h1>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Избери обект</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(properties ?? []).map(p => (
                <Link
                  key={p.id}
                  href={`/finance/withdrawals/new?property_id=${p.id}`}
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
    // MANAGER / DEPT_HEAD: resolve property from user_property_access
    const { data: accessRecords } = await supabase
      .from('user_property_access')
      .select('property_id')
      .eq('user_id', user.id)
      .limit(1)

    if (!accessRecords || accessRecords.length === 0) {
      return (
        <div className="p-6 max-w-4xl mx-auto">
          <p className="text-muted-foreground text-sm">
            Нямате присвоен обект. Свържете се с администратор.
          </p>
        </div>
      )
    }

    propertyId = accessRecords[0].property_id
  }

  // Fetch bank accounts for BANK_IN purpose
  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('id, name, iban')
    .eq('status', 'ACTIVE')
    .order('name')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Ново теглене</h1>
      <WithdrawalForm
        propertyId={propertyId}
        bankAccounts={(bankAccounts ?? []) as { id: string; name: string; iban: string }[]}
      />
    </div>
  )
}
