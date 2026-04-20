import { NextRequest, NextResponse } from 'next/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { reportQuerySchema } from '@/lib/finance/schemas'
import { computeOperationalReport } from '@/lib/finance/opreport/compute'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'opreport.view')))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = reportQuerySchema.safeParse(params)
  if (!parsed.success)
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(parsed.data.property_id))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const matrix = await computeOperationalReport(parsed.data.property_id, parsed.data.year, parsed.data.vat_mode)
  return NextResponse.json(matrix)
}
