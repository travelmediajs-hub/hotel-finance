import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  password: z.string().min(6).max(100),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', message: 'Паролата трябва да е поне 6 символа' },
      { status: 400 },
    )
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    return NextResponse.json(
      { error: 'update_failed', message: error.message },
      { status: 400 },
    )
  }

  return NextResponse.json({ ok: true })
}
