import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'users.manage'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  // Check if any employees use this position
  const { count } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('position_id', id)

  if (count && count > 0) {
    return NextResponse.json(
      { message: 'Длъжността е в употреба от служители' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('positions').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
