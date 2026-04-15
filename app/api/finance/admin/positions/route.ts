import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  sort_order: z.number().int().default(0),
})

export async function GET() {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('positions')
    .select('id, name, sort_order')
    .order('sort_order')

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'users.manage'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('positions')
    .insert({ name: parsed.data.name, sort_order: parsed.data.sort_order })
    .select('id, name, sort_order')
    .single()

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
