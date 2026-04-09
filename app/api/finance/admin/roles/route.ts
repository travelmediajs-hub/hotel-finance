import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { z } from 'zod'

const createRoleSchema = z.object({
  key: z.string().regex(/^[A-Z0-9_]+$/, 'Ключът трябва да е с главни букви, цифри и _').min(2).max(40),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
})

export async function GET() {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'roles.view'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .select('key, label, description, is_system, created_at')
    .order('is_system', { ascending: false })
    .order('label')
  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'roles.manage'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const parsed = createRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .insert({ ...parsed.data, is_system: false })
    .select()
    .single()
  if (error) {
    return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
