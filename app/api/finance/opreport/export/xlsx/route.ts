import { NextRequest, NextResponse } from 'next/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { exportQuerySchema } from '@/lib/finance/schemas'
import { computeOperationalReport } from '@/lib/finance/opreport/compute'
import { buildOpReportXlsx } from '@/lib/finance/opreport/xlsx'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'opreport.view')))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = exportQuerySchema.safeParse(params)
  if (!parsed.success)
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(parsed.data.property_id))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: property } = await supabase
    .from('properties')
    .select('name')
    .eq('id', parsed.data.property_id)
    .single()

  const matrix = await computeOperationalReport(parsed.data.property_id, parsed.data.year, parsed.data.vat_mode)
  const buffer = buildOpReportXlsx(matrix, parsed.data.view, property?.name ?? 'Unknown')

  const safeName = (property?.name ?? 'property').replace(/[^a-z0-9_-]+/gi, '_')
  const filename = `operational-pl-${safeName}-${parsed.data.year}-${parsed.data.view}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
