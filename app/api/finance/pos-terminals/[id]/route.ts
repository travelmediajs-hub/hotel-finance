import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const user = await getFinanceUser()
  if (!user || user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params

  const supabase = await createClient()
  const { error } = await supabase
    .from('pos_terminals')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
